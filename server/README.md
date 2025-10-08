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
```

The client defaults to `http://localhost:8000/api`. Set `VITE_API_URL` in `client/.env` to change it.

## Folder layout

```
app/
  Features/
    Auth/        login, logout, current user, forgot/reset password
    Accounts/    Owner's Account Provision: invite, edit, (de)activate, delete; accept invitation
    Branches/    Owner's Branches page: add, edit, (de)activate, delete; branch list for everyone
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
| Purchase Officer | Purchases, Supplier Returns, Reports |

`Role::sections()` is the single source: `/api/auth/me` returns it and the client builds the sidebar and route guards from it. Protect new endpoints with the same roles, e.g. `Route::middleware(['auth:sanctum', 'role:cashier'])`.

## Account flow

1. The Owner creates an account (`POST /api/accounts`). It starts as **Pending** and an invitation email is sent over Gmail SMTP. If the email fails, nothing is saved.
2. The link opens `FRONTEND_URL/accept-invitation?token=…` and is valid for `INVITATION_EXPIRE_HOURS` (default 72). Only a SHA-256 hash of the token is stored.
3. The person sets a password (at least 8 characters, letters and numbers). The account becomes **Active**, they're signed in, and they land on their role's first section.
4. Later visits: email + password at `/login` (5 attempts per minute per email and IP).
5. Forgot password: `/forgot-password` emails a link to `/reset-password`, valid for 60 minutes. Resetting signs out every device.

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
| GET / POST | `/api/accounts` | Owner |
| PATCH / DELETE | `/api/accounts/{id}` | Owner |
| POST | `/api/accounts/{id}/resend-invitation` | Owner |
