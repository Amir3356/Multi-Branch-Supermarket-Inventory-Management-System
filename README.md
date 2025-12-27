# PharmaCare: Multi-Branch Pharmacy Management System

PharmaCare is a web system for running a pharmacy with several branches. It covers buying stock, receiving it into inventory, selling it, moving it between branches, writing off damaged items, recording expenses, and reporting on all of it. Every screen updates live. Each user sees only what their role allows, and every action is recorded in an audit log.

- **Frontend:** React 19, Redux Toolkit, React Router, Vite (`client/`)
- **Backend:** Laravel 13 (PHP 8.3) REST API, organised by feature (`server/app/Features/`)
- **Database:** PostgreSQL
- **Live updates:** Laravel Reverb (WebSockets) with Laravel Echo
- **Authentication:** Laravel Sanctum API tokens
- **Payments:** Chapa hosted checkout (with a built-in fake checkout for local development)
- **AI:** OpenRouter (chat completions) for the AI Assistance feature

---

## 1. Users and roles

The system has four roles. The server decides what each role may open, and the sidebar and page guards in the browser follow the same list.

| Role | Branch | What they do |
|---|---|---|
| **Owner** | All branches | Manages staff accounts, branches and sessions. Sees the dashboard, all five reports, audit logs and access reviews. |
| **Pharmacist** (Inventory Officer) | One branch | Adds received stock, corrects stock, sets selling prices, sends and receives transfers, records damaged items and expenses, and sets the stock policy. |
| **Cashier** | One branch | Records sales at their branch. |
| **Procurement Officer** | All branches | Creates purchase orders for any branch and pays for them through Chapa. |

| Section | Owner | Pharmacist | Cashier | Procurement Officer |
|---|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Account Provision (accounts, sessions, access reviews) | ✓ | | | |
| Branches | ✓ | | | |
| Inventory | | ✓ | | |
| Sales | | | ✓ | |
| Procurement | | | | ✓ |
| Stock Transfers | | ✓ | | |
| Damaged | | ✓ | | |
| Expenses | | ✓ | | |
| Settings (policy) | | ✓ | | |
| Notifications | | ✓ | | |
| Reports | All five reports | Inventory Report (own branch) | Sales Report (own branch, no cost or profit) | Procurement Report |
| Audit Logs | ✓ | | | |
| AI Assistance | ✓ | ✓ | ✓ | ✓ |

---

## 2. Functional requirements

### FR-1 Authentication and sessions
- **FR-1.1** Users sign in with email and password. After 5 failed attempts, sign-in from that source is blocked for a minute.
- **FR-1.2** Users can request a password reset by email (at most one email per account per minute). Resetting the password signs out every other session.
- **FR-1.3** A deactivated account cannot sign in, and its open sessions end immediately.
- **FR-1.4** Users are signed out automatically after a period of inactivity (`SESSION_TIMEOUT_MINUTES`). A session token expires after 7 days at most.
- **FR-1.5** Each sign-in is a separate session, named after the browser that opened it.
- **FR-1.6** The Owner can see every session from the last 7 days in Session Monitoring: user, device, IP address, location, and whether it is active, idle or ended. The Owner can end any session, and that browser is signed out at once.
- **FR-1.7** With the user's permission, the browser reports its location, which is shown as a place name (for example "Addis Ababa, Bole, Ethiopia"). Otherwise the city is worked out from the IP address.

### FR-2 Account provision
- **FR-2.1** The first Owner account is created from the command line (`php artisan owner:create`).
- **FR-2.2** The Owner invites staff by email with a role. Pharmacists and Cashiers must be assigned a branch. The Procurement Officer covers every branch and has none.
- **FR-2.3** The invited person opens the emailed link, sets a password and is signed in. Links expire after `INVITATION_EXPIRE_MINUTES`, and the Owner can resend them.
- **FR-2.4** The Owner can edit, activate, deactivate and delete staff accounts. Every change to role, branch or status is kept as history.

### FR-3 Access reviews
- **FR-3.1** The Owner can generate an access review for a period (today, this week, month, quarter or year, or a custom range). It is a snapshot of every account with its role, branch, status and last sign-in.
- **FR-3.2** The review flags dormant accounts (no sign-in for `ACCESS_REVIEW_DORMANT_DAYS`), role changes and expired invitations.
- **FR-3.3** Reviews can optionally be generated automatically after each finished period (`ACCESS_REVIEW_SCHEDULE`).

### FR-4 Branches
- **FR-4.1** The Owner can add, edit, activate and deactivate branches. Branches get IDs `BR-01`, `BR-02` and so on, and branch names must be unique regardless of case.
- **FR-4.2** A deactivated branch is closed, so no new sales, expenses or other changes can be recorded there.
- **FR-4.3** A branch that still has staff cannot be deleted. Its history (sales, procurements, transfers) is always kept.

### FR-5 Product catalog and pricing
- **FR-5.1** All branches share one product catalog, grouped by category.
- **FR-5.2** The Pharmacist sets a product's selling price. The new price reaches every screen at once, so a Cashier can sell at the new price immediately.

### FR-6 Procurement
- **FR-6.1** The Procurement Officer creates a purchase order for a branch with supplier, product, quantity and total cost. The server calculates the unit price; it never takes prices from the browser.
- **FR-6.2** Orders get IDs `PO-00001` and so on and are paid through Chapa's hosted checkout. An order goes through the stages *Awaiting payment → Paid, awaiting delivery → Received*, or ends as *Payment failed*.
- **FR-6.3** A payment is only accepted after the server verifies it with Chapa. A background job re-checks pending payments every 5 minutes, in case Chapa's callback never arrived.
- **FR-6.4** When the stock arrives, the receiving branch's Pharmacist adds it to inventory and sets a selling price. The system generates a batch number for it.

### FR-7 Inventory and stock
- **FR-7.1** Stock is held per branch and per batch, with quantity, expiry date and purchase price.
- **FR-7.2** Each item is flagged *Low Stock*, *Out of Stock*, *Expiring Soon* or *Expired*, using the policy's minimum stock and expiry warning days.
- **FR-7.3** The Pharmacist can correct a batch at their own branch (counted quantity, expiry date). Every correction is recorded.
- **FR-7.4** Stock changes only through recorded actions: a sale, transfer, damage write-off, received order or correction. Stock can be rebuilt from those records (`php artisan stock:rebuild`).

### FR-8 Sales
- **FR-8.1** The Cashier records sales at their own active branch. Units are taken from batches first in, first out.
- **FR-8.2** A sale can't take more units than a batch holds, even if two cashiers sell the same last units at the same moment.
- **FR-8.3** Sending the same sale twice (for example after a network error) records it only once, using the `Idempotency-Key` header.

### FR-9 Stock transfers
- **FR-9.1** A Pharmacist sends stock from their branch to another active branch.
- **FR-9.2** The receiving branch's Pharmacist receives it into their own stock with the same expiry date.

### FR-10 Damaged items
- **FR-10.1** The Pharmacist writes off damaged stock from a batch at their branch. The stock goes down immediately.
- **FR-10.2** The server calculates the loss value from the purchase price, so the Owner's profit figures can rely on it.

### FR-11 Expenses
- **FR-11.1** The Pharmacist records and deletes their branch's expenses, dated up to today.
- **FR-11.2** The Owner and Procurement Officer can view expenses for every branch.

### FR-12 Policy and notifications
- **FR-12.1** The Pharmacist sets the pharmacy policy: default minimum stock and expiry warning days. A change reaches every open screen at once.
- **FR-12.2** Notifications are generated from current stock (low, out of stock, expiring, expired) and from tax due dates. Users can mark them read or dismiss them.

### FR-13 Dashboards
- **FR-13.1** Each role has its own dashboard of cards and charts for a period they pick:
  - **Owner:** sales, purchases, expenses, damage losses and estimated net profit, for every branch or one.
  - **Pharmacist:** stock that needs attention and stock waiting to be added.
  - **Cashier:** their branch's sales.
  - **Procurement Officer:** purchases and payment status.

### FR-14 Reports
- **FR-14.1** Five reports, each for a chosen period, for every branch or one: **Sales**, **Inventory**, **Financial** (profit and loss compared with the previous period), **Procurement** and **User**.
- **FR-14.2** Each report has summary cards, charts and detailed tables, and can be exported to PDF.
- **FR-14.3** Reports refresh live when the underlying data changes.
- **FR-14.4** Access is by role:
  - **Owner:** all five reports.
  - **Pharmacist:** the Inventory Report for their own branch.
  - **Cashier:** the Sales Report for their own branch, without cost or profit figures.
  - **Procurement Officer:** the Procurement Report.

  The server enforces the branch limit for branch staff.

### FR-15 Audit logs
- **FR-15.1** Every significant action is recorded with who did it, when, from which IP address and device, on which branch, and what changed. This covers sign-ins, account changes, sales, stock, procurement, transfers, damage, expenses, policy and branches.
- **FR-15.2** The Owner can filter and search the log by date, module, branch and text. Entries are read-only and can never be edited or deleted.
- **FR-15.3** New entries appear on the Owner's Audit Logs page live.

### FR-16 AI Assistance
- **FR-16.1** Every role gets AI-written recommendations and can chat with the assistant about their own data.
- **FR-16.2** The assistant only receives what that role is allowed to see, and branch staff only their own branch. No customer or staff names are sent.
- **FR-16.3** For the Owner, the system calculates forecasts from sales history: next 30 days' revenue, when products will run out, what to reorder and by when, and stock likely to expire unsold. The AI explains these figures; it does not invent its own predictions.

---

## 3. Non-functional requirements

### NFR-1 Security
- **NFR-1.1 Role-based access control:** every API route checks the user's role on the server (`role:` middleware). Branch staff are limited to their own branch in the query itself, not only in the browser.
- **NFR-1.2 Authentication:** passwords are stored hashed. API access uses Sanctum tokens that expire, and an ended session is rejected on its next request.
- **NFR-1.3 Rate limiting:**

  | Endpoint | Limit |
  |---|---|
  | Sign-in | 5 attempts |
  | Password reset | 5 per minute |
  | Invitation links | 20 per minute |
  | AI Assistance | 20 per minute per user |
  | Chapa callbacks | 60 per minute |
  | Device location | 10 per minute |

- **NFR-1.4 Trusted figures:** totals, unit prices, loss values and payment status are calculated or verified on the server, never taken from the browser. A Chapa callback can only trigger verification; it cannot mark an order paid by itself.
- **NFR-1.5 Data minimisation:** cost and profit are hidden from Cashiers. Data sent to outside services (the AI model, IP location lookup) is limited to what is needed. IP lookup can be turned off (`IP_LOCATION_LOOKUP=false`).

### NFR-2 Data integrity and reliability
- **NFR-2.1** Every stock change runs in the same database transaction as the record that causes it, with row locking. Stock and its records never disagree, and concurrent sales can't oversell.
- **NFR-2.2** Sales are idempotent, so a retried request never creates a duplicate.
- **NFR-2.3** History is never lost. Branches with records can't be deleted, accounts keep their change history, and audit logs are append-only.
- **NFR-2.4** If the WebSocket server (Reverb) is down, saving still works. Screens catch up when they reconnect and otherwise refresh every minute.
- **NFR-2.5** Scheduled jobs handle unattended work:
  - verify pending payments (every 5 minutes)
  - expire inactive sessions (every 5 minutes)
  - prune old sessions (daily)
  - generate scheduled access reviews

### NFR-3 Performance
- **NFR-3.1** Dashboard and report figures are calculated in the database (sums and groupings), not by loading rows into PHP.
- **NFR-3.2** Audit logs are paginated and filtered on the server.
- **NFR-3.3** Slow outside lookups are cached: IP and place-name lookups for 30 days, AI recommendations for a short time.
- **NFR-3.4** Updates are pushed over WebSockets instead of polling, and a burst of changes triggers only one report reload.

### NFR-4 Real-time behaviour
- **NFR-4.1** Changes to sales, stock, procurement, transfers, damage, expenses, prices, policy, branches and sessions reach every affected screen within moments, without a page reload.
- **NFR-4.2** Live channels are private and authorised. Branch staff hear only their own branch, and only the Owner hears audit logs and session activity.

### NFR-5 Usability
- **NFR-5.1** Each role sees only its own sidebar sections and lands on its own dashboard.
- **NFR-5.2** Error messages say what happened and what to do, for example "This branch is inactive, ask the Owner to activate it".
- **NFR-5.3** The layout is responsive and works on desktop and mobile screens.
- **NFR-5.4** Reports can be exported to PDF for printing or sharing.

### NFR-6 Correct dates and money
- **NFR-6.1** Times are stored in UTC. "Today", "this month" and report periods follow the pharmacy's local time zone (`PHARMACY_TIMEZONE`, default `Africa/Addis_Ababa`).
- **NFR-6.2** Money is shown in ETB and rounded to cents. The Owner's dashboard and the Financial Report use the same calculation, so they always agree.

### NFR-7 Maintainability
- **NFR-7.1** The backend is organised by feature (`app/Features/<Feature>/` with Controllers, Requests, Repositories, Services, Events and Routes). All database access goes through repositories.
- **NFR-7.2** The frontend is organised by feature (`client/features/<feature>/` with api, store, hooks, services and components).
- **NFR-7.3** Settings that change between installations (time zone, invitation expiry, session timeouts, dormant days, Chapa mode, AI model) come from environment variables, not code.

### NFR-8 Portability and integration
- **NFR-8.1** `CHAPA_MODE=fake` provides a local checkout page, so the payment flow can be developed and demonstrated without a live Chapa account.
- **NFR-8.2** The AI provider is reached through OpenRouter's OpenAI-compatible API, so the model can be changed with `OPENROUTER_MODEL`.

---

## 4. Running the system

**Requirements:** PHP 8.3+, Composer, Node.js, and PostgreSQL.

```bash
# Backend
cd server
composer install
cp .env.example .env          # set DB_*, MAIL_*, REVERB_*, CHAPA_*, OPENROUTER_API_KEY
php artisan key:generate
php artisan migrate
php artisan owner:create      # the first Owner account

php artisan serve             # API
php artisan reverb:start      # live updates (WebSockets)
php artisan schedule:work     # background jobs

# Frontend
cd client
npm install
cp .env.example .env          # VITE_API_URL and VITE_REVERB_*
npm run dev
```
