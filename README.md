# Gymkhana Inventory

BERM equipment inventory API and web UI for managing assets, borrowing, and alerts.

## Stack

- **Backend:** Node.js, Express, PostgreSQL, PASETO auth
- **Frontend:** React + Vite (in `frontend/`)

## Setup

```bash
cp .env.example .env
# set DATABASE_URL and PASETO_V3_LOCAL_KEY_BASE64

npm install
npm run db:migrate
```

To add a starter administrator, catalog, location, and sample asset to a local database, set `SEED_ADMIN_PASSWORD` in `.env` and run:

```bash
npm run db:seed:default
```

`npm run start:prod` runs migrations and seeds a small, repeatable demo inventory before starting the API. Set the Render service's Start Command to `npm run start:prod` to seed automatically on each deployment. The seeder accepts Render's internal database URL when running on a Render service; for a manual run from your machine, set `DATABASE_URL` to the Render external database URL and run:

```bash
npm run db:seed:demo -- --confirm-render
```

The seed creates clearly labeled demo users, roles, categories, locations, assets, an active loan, and a low-stock alert. It does not delete or overwrite existing records; demo users have no password and cannot log in.

Generate a PASETO key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Run

Terminal 1 — API (port 3000):

```bash
npm run dev
```

Terminal 2 — UI (port 5173, proxies `/api` to the backend):

```bash
npm run dev:frontend
```

Open http://localhost:5173

## Frontend pages

| Page | Purpose |
|------|---------|
| Login / Register | Auth |
| Dashboard | Inventory counts, overdue loans, and open alerts; refresh and retry controls with loading and error states |
| Assets | Search, create, delete equipment |
| Borrowing | Request / issue / return / renew / cancel |
| Alerts | Acknowledge, resolve, dismiss, generate |
| Catalog | Categories, locations, org units |

## Access roles

| Access level | Assigned roles | Permissions |
|--------------|----------------|-------------|
| Superadmin | `super_admin` | Global access, including role and organization management |
| Admin | `org_admin`, `berm_incharge` | Manage inventory and workflows within assigned organization units |
| User | `borrower` | Read the available inventory sections and manage only their own borrowing |
| Auditor | `auditor` | Read-only reports and audit information |

Only superadmins can assign roles. Public registration and admin-created accounts receive the borrower role by default.
