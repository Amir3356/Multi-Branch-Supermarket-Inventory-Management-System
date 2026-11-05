# PharmaCare server: Express.js microservices

The multi-branch pharmacy inventory API, split into independent services behind one API gateway. The React client
talks only to the gateway at `http://localhost:8000` (`/api/*` for requests, `/socket.io` for live updates).
[ARCHITECTURE.md](ARCHITECTURE.md) covers service boundaries, data ownership, the layered code structure and the
internal APIs.

| Service | Port | Responsibility | Tables it owns |
|---------|------|----------------|----------------|
| api-gateway | 8000 | Single entry point: authenticates each request, routes it, proxies Socket.IO | none |
| auth-service | 4001 | Sign-in/out, password reset, sessions (Session Monitoring), token checks | sessions, reset tokens, sign-ins |
| user-service | 4002 | Staff accounts, invitations, user (access review) reports | users, invitations, account history, access reviews |
| branch-service | 4003 | Branches, pharmacy policy (low-stock and expiry thresholds) | branches, policy |
| inventory-service | 4004 | Product catalog and prices, stock batches, transfers, damaged items | products, stock, transfers, damaged items |
| sales-service | 4005 | Sales (point of sale), branch expenses | sales, expenses |
| procurement-service | 4006 | Purchase orders, Chapa payments, receiving paid stock | procurements |
| reporting-service | 4007 | Sales/inventory/financial/procurement/user reports, Owner dashboard, audit logs | audit logs |
| ai-service | 4008 | Role-specific AI recommendations and chat (OpenRouter) | none (reads only) |
| notification-service | 4009 | Live updates over Socket.IO, outgoing email | none |

Each service has the same layered structure:

```
<name>/                 (each service is a folder directly under server/)
  index.js   routes/   middleware/   controllers/   services/   repositories/   models/   utils/
  migrations/   migrate.js   seed/ (auth-service)   .env.example   Dockerfile   .dockerignore   package.json
```

## Run with Docker (simplest)

```bash
cd server
for s in */; do cp -n "$s.env.example" "$s.env"; done   # then give every .env the SAME INTERNAL_SERVICE_SECRET
DB_PASSWORD=choose-one docker compose up --build       # PostgreSQL + every service; each migrates its own tables
docker compose exec auth-service npm run seed          # Owner (admin) account + demo staff
```

## Run locally without Docker

Requirements: Node.js 20+ and PostgreSQL. Each service is its own npm project.

```bash
cd server
# each service has its own settings: copy <name>/.env.example to <name>/.env, then set DB_* and
# the SAME INTERNAL_SERVICE_SECRET in every one
for s in */; do cp -n "$s.env.example" "$s.env"; done

# once per service: install and create its tables
for s in */; do (cd "$s" && npm install && { [ -f migrate.js ] && npm run migrate || true; }); done

(cd auth-service && npm run seed)        # Owner (admin) credentials + demo staff
```

Then start each service in its own terminal with `npm run dev` (restarts on change) from its folder, for example
`cd api-gateway && npm run dev`. Start the client with `cd client && npm install && npm run dev` and open
http://localhost:5173. `GET http://localhost:8000/health` shows whether every service is up.

## Service commands

| Where | Command | What it does |
|-------|---------|--------------|
| every service | `npm run dev` / `npm start` | Run it, with or without restart-on-change |
| services with tables | `npm run migrate` | Create or update the service's own tables |
| auth-service | `npm run seed` | Seed the Owner (admin) credentials and demo staff accounts (`seed/admin.seed.js`) |
| user-service | `npm run create-owner` | Create the Owner account interactively |
| inventory-service | `npm run rebuild-stock` | Recompute stock batches from sales, transfers, damaged items and received orders |

## Moving from the Laravel server

- **Database:** point each service's `.env` (`DB_*`) at the existing database and run each service's migrations. They only create what is
  missing, adding one new table, `stock_movements`, which makes stock changes between services idempotent.
- **Sign-ins:** existing passwords and session tokens keep working, so nobody has to sign in again.
- **Client:** live updates now use Socket.IO through the gateway instead of Laravel Reverb. Replace the old
  `VITE_REVERB_*` settings with `VITE_API_URL` (and `VITE_REALTIME_URL` if the gateway isn't at the API URL's origin).
- **Scheduler:** Laravel's `schedule:work` is gone. Each service runs its own jobs: session expiry (auth), Chapa payment
  checks (procurement), scheduled user reports (user).
- **Rate limits and small caches** live in each service's memory. When running several copies of a service behind a
  load balancer, move them to a shared store.
