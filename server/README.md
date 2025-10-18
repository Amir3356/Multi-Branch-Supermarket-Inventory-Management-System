# PharmaCare API (Laravel)

A monolithic Laravel 13 API with feature-based folders. The React app in `../client` talks to it over `/api` using Sanctum bearer tokens.

## Setup

```bash
# PHP extensions Laravel needs that this machine was missing
sudo apt install php8.5-pgsql php8.5-mbstring

# PostgreSQL: start it and create the database named in .env
sudo systemctl enable --now postgresql
sudo -u postgres createdb multi_branch_pharmacy

cp .env.example .env            # first time only; then fill in DB_PASSWORD and the Gmail app password
php artisan key:generate        # first time only
php artisan migrate --seed      # tables + the Owner account (OwnerSeeder)
# php artisan owner:create      # alternative: type the Owner details in instead of seeding them
php artisan serve               # http://localhost:8000
php artisan reverb:start        # WebSockets on :8080 (live Session Monitoring), in a second terminal
```

The client defaults to `http://localhost:8000/api`. Set `VITE_API_URL` in `client/.env` to change it.

## Folder layout

```
app/
  Features/
    Auth/        login, logout, current user, forgot/reset password
    Accounts/    Owner's Account Provision: invite, edit, (de)activate, delete; accept invitation
    Branches/    Owner's Branches page: add, edit, (de)activate, delete; branch list for everyone
    AccessReviews/  Owner's access review reports for a chosen period: users, roles, last login, flags; PDF export
    Sessions/    Owner's Session Monitoring: every sign-in (one Sanctum token) with device, IP, last activity; end or remove
    <Feature>/
      Controllers/  Requests/  Resources/  Models/  Services/  Mail/  Console/  views/
      routes.php    loaded automatically by routes/api.php
  Shared/
    Enums/Role.php            roles + which sections each role may open (RBAC)
    Enums/AccountStatus.php   invited | active | inactive
    Http/Middleware/EnsureRole.php   ->middleware('role:owner')
```

A feature's Blade views are namespaced by folder name, so `app/Features/Accounts/views/mail/invitation.blade.php` is `accounts::mail.invitation`.

## Roles (RBAC)

| Role | Sections (first = landing page) |
| --- | --- |
| Owner | Account Provision, Branches, Audit Logs, Reports |
| Pharmacist (Inventory Officer) | Dashboard, Inventory, Stock Transfers, Damaged, Policy, Reports, Notifications |
| Cashier | Sales, Customer Returns, Reports |
| Procurement Officer | Procurement, Supplier Returns, Reports |

`Role::sections()` is the single source: `/api/auth/me` returns it and the client builds the sidebar and route guards from it. Protect new endpoints with the same roles, e.g. `Route::middleware(['auth:sanctum', 'role:cashier'])`.

## Account flow

1. The Owner creates an account (`POST /api/accounts`). It starts as **Pending** and an invitation email is sent over Gmail SMTP. If the email fails, nothing is saved.
2. The link opens `FRONTEND_URL/accept-invitation?token=…` and is valid for `INVITATION_EXPIRE_HOURS` (default 72). Only a SHA-256 hash of the token is stored.
3. The person sets a password. The account becomes **Active**, they're signed in, and they land on their role's first section.
4. Later visits: email + password at `/login` (5 attempts per minute per email and IP).
5. Forgot password: `/forgot-password` emails a link to `/reset-password`, valid for 60 minutes. Resetting signs out every other device, then signs this browser in and opens the role's home page.

The Owner can resend an invitation, change name, role and branch, deactivate (signs the user out everywhere) or delete staff accounts. The Owner account itself can't be changed from the API.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | public, throttled |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | signed in |
| GET | `/api/invitations/{token}` | public, throttled |
| POST | `/api/invitations/{token}/accept` | public, throttled |
| GET | `/api/branches` | signed in |
| POST | `/api/branches` | Owner (ids BR-01, BR-02… are generated) |
| PATCH / DELETE | `/api/branches/{id}` | Owner (delete refused while staff are assigned) |
| GET | `/api/sessions` | Owner (sign-ins from the last 7 days) |
| POST | `/api/sessions/{id}/end` | Owner (signs that device out) |
| DELETE | `/api/sessions/{id}` | Owner (signs out and removes from the list) |
| GET / POST | `/api/access-reviews` | Owner (list; generate for `period` daily, weekly, monthly, quarterly, yearly with `scope` current or previous, or custom with `from`/`to`) |
| GET / DELETE | `/api/access-reviews/{id}` | Owner (full report; delete) |
| GET / POST | `/api/accounts` | Owner |
| PATCH / DELETE | `/api/accounts/{id}` | Owner |
| POST | `/api/accounts/{id}/resend-invitation` | Owner |

## Sessions

Session Monitoring is live over WebSockets (Laravel Reverb). Sign-ins, sign-outs, ended sessions, activity (at most once a minute per session) and location updates are pushed to the private `sessions` channel, which only the Owner can join. The page then reloads its list. When a session is ended (by the Owner, deactivation, deletion or a password reset), a `session.ended` message also goes to the private `session.{id}` channel, which only the browser holding that session can join. That browser signs out at once and shows the reason. If Reverb isn't running, signing in still works: the missed update is logged as a warning, and the page shows "Reconnecting…" and refreshes every minute.

Each sign-in creates one Sanctum token, which is one session. Ending a session (Sign Out, the Owner, deactivation, password reset) stamps `ended_at` instead of deleting the row, and Sanctum rejects ended tokens. Each request updates the session's last activity and IP address. The Location column comes from ipwho.is: each public IP is looked up once, after the response is sent, and cached for 30 days. Local and private addresses show "Local network" and are never sent out. Set `IP_LOCATION_LOOKUP=false` to turn the lookup off. For a precise place, each browser is asked once per sign-in for its location (`DEVICE_LOCATION=true`). If the person allows it, the position is named with OpenStreetMap (e.g. "Addis Ababa, Bole, Ethiopia"), cached per ~100 m spot for 30 days, and shown with a map-pin. If they block it, the IP-based city stays. The browser's location prompt only works on `localhost` or over HTTPS. Rows older than 30 days are deleted whenever the Owner opens the session list, so no scheduler is needed.

When deployed behind a reverse proxy or load balancer, set `TRUSTED_PROXIES` in `.env` (the proxy's IP addresses, comma-separated, or `*`) so sessions show the visitor's real IP instead of the proxy's.

## Access reviews

On Account Provision, tabs (All, Daily, Weekly, Monthly, Quarterly, Yearly, Custom) filter the list of reports. The Owner clicks **Generate report** and, in the dialog, chooses a **Report period** and either the last finished period (Yesterday, Last week/month/quarter/year — a **Complete** report) or the current one so far (a **Partial** report) (Daily, Weekly, Monthly, Quarterly, Yearly, or a custom date range) and confirms. Generating the same period again replaces its earlier report with fresh data; reports can also be deleted. The report snapshots every account: role, branch, status, last login, and role changes during the period. It flags:

- **Dormant:** active, but no sign-in for `ACCESS_REVIEW_DORMANT_DAYS` (default 90)
- **Role changed:** possible privilege creep; every role change is recorded in `account_role_changes`
- **Invitation not accepted:** after `ACCESS_REVIEW_STALE_INVITATION_DAYS` (default 30)
- **Deactivated:** still on file

The Owner opens a report and exports it as a PDF, which ends with blank Reviewed by / Signature / Date lines for signing a printed copy. Periods ("today", "this month"…) and custom ranges use the pharmacy's local time, `PHARMACY_TIMEZONE` (default `Africa/Addis_Ababa`); the database stays in UTC.
