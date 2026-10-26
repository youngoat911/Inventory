# Gymkhana Inventory

BERM equipment inventory management system featuring a modular REST API backend and a responsive React web interface for managing assets, borrowing workflows, transfers, audits, and real-time alerts.

## Architecture & Directory Structure

```
Inventory/
├── server.js                            # Application entry point & server lifecycle
├── package.json                         # Node dependencies & npm scripts
├── docker-compose.yml                   # Containerized services (PostgreSQL & app)
│
├── src/                                 # Backend Source Code
│   ├── app.js                           # Express application & global middleware
│   ├── config/                          # Environment configuration & validation
│   ├── db/                              # Database pool & transaction helpers
│   ├── middleware/                      # Authentication & operational middlewares
│   │   ├── authenticate.js              # PASETO bearer token authentication
│   │   ├── authorize.js                 # Role & org-scoped RBAC authorization
│   │   ├── error-handler.js             # Centralized JSON error responses
│   │   ├── not-found.js                 # 404 handler
│   │   ├── request-id.js                # Distributed tracing request IDs
│   │   └── request-logger.js            # Structured HTTP request logger
│   ├── middlewares/                     # Compatibility proxy for backwards-compatible imports
│   ├── shared/                          # Domain-agnostic utilities (AppError, Audit, Logger)
│   ├── utils/                           # PASETO cryptography & logging utilities
│   ├── routes/
│   │   ├── api.routes.js                # Centralized /api/v1 router mounting all domains
│   │   └── auth.routes.js               # Route alias for auth module
│   ├── controllers/
│   │   └── auth.controller.js           # Controller facade for auth module
│   └── modules/                         # Domain-Driven Feature Modules
│       ├── alerts/                      # Automated threshold & overdue alert generation
│       ├── assets/                      # Asset catalog, barcodes, lifecycle, tracking
│       ├── audit-log/                   # Immutable audit logging for security compliance
│       ├── auth/                        # Registration, login, password reset & PASETO tokens
│       ├── blocks/                      # Borrower blocks & restrictions
│       ├── borrower-blocks/             # Borrower blocks (retained for compatibility)
│       ├── categories/                  # Asset classifications
│       ├── drop-boxes/                  # Physical return drop box endpoints
│       ├── issues/                      # Asset checkouts, returns, renewals & loan lifecycle
│       ├── locations/                   # Physical storage & warehouse locations
│       ├── org-units/                   # Campus/organization units & departments
│       ├── purchases/                   # Asset acquisition records & vendor purchases
│       ├── reports/                     # Utilization, overdue loans & cost analytics
│       ├── roles/                       # System RBAC roles & user assignments
│       ├── transfers/                   # Custody transfers between organization units
│       ├── users/                       # User management & account statuses
│       └── vendors/                     # Supplier & vendor directories
│
├── frontend/                            # React + Vite Client Application
│   ├── src/
│   │   ├── api/                         # Frontend API client
│   │   ├── auth/                        # Auth context & ProtectedRoute guards
│   │   ├── components/                  # Layout, Modals, Badges, Pagination
│   │   ├── pages/                       # Route views (Dashboard, Assets, Users, etc.)
│   │   └── styles/                      # Design system & responsive CSS
│   └── vite.config.js                   # Vite config with /api proxy
│
├── scripts/                             # Utility & Database Scripts
│   ├── manual-tests/                    # Verification & automated sanity scripts
│   ├── create-test-user.js              # CLI test user generator
│   ├── deployment-check.js              # Production readiness inspection
│   └── seed-demo-data.js                # Idempotent demo data seeder
│
├── migrations/                          # PostgreSQL schema migrations (node-pg-migrate)
└── tests/                               # Test suites (Vitest)
    ├── helpers/                         # Test fixtures & database cleanup
    ├── integration/                     # Endpoint integration test suites
    └── unit/                            # Unit tests for core authorization & logic
```

---

## Tech Stack

- **Backend:** Node.js (ES Modules), Express 5, PostgreSQL (`pg`), PASETO V3 tokens, Argon2 password hashing, Zod schema validation.
- **Frontend:** React 19, Vite 8, Vanilla CSS Design System with responsive navigation and glassmorphism.
- **Database Migrations:** `node-pg-migrate`.
- **Testing:** Vitest, Supertest.

---

## Getting Started

### 1. Environment Setup

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

Ensure your `.env` contains valid credentials matching your PostgreSQL database:

```ini
PORT=3000
DATABASE_URL=postgres://berm_app:change_me@localhost:5432/berm_inventory
PASETO_V3_LOCAL_KEY_BASE64=<your-base64-key>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

To generate a secure 32-byte PASETO key in base64:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Database Setup (PostgreSQL)

You can run PostgreSQL locally using either Docker or a native PostgreSQL installation:

#### Option A: Run with Docker Compose (Recommended)
Make sure Docker Desktop or Docker daemon is running, then start the container:

```bash
docker compose up -d
```
This automatically starts a PostgreSQL 16 instance with:
- **Database:** `berm_inventory`
- **User:** `berm_app`
- **Password:** `change_me`
- **Port:** `5432`

#### Option B: Native PostgreSQL
If you already have PostgreSQL running natively:

```sql
CREATE USER berm_app WITH PASSWORD 'change_me';
CREATE DATABASE berm_inventory OWNER berm_app;
GRANT ALL PRIVILEGES ON DATABASE berm_inventory TO berm_app;
```

### 3. Install Dependencies

Install root backend dependencies:
```bash
npm install
```

Install frontend dependencies:
```bash
npm --prefix frontend install
```

### 4. Database Migration & Seeding

Run database migrations:
```bash
npm run db:migrate
```

To seed demo data (creates sample users, roles, categories, locations, assets, and active loans):
```bash
# Local development:
npm run db:seed:demo

# For manual execution against a remote database (e.g. Render):
npm run db:seed:demo -- --confirm-render
```

---

## Running the Application

### Development Mode

Run backend and frontend concurrently (or in two separate terminals):

**Terminal 1 — Backend API (port 3000):**
```bash
npm run dev
```

**Terminal 2 — Frontend UI (port 5173):**
```bash
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173) in your browser. (Vite automatically proxies `/api` and `/health` requests to `http://localhost:3000`).

### Production Build

```bash
# Build frontend bundle
npm run build:frontend

# Run production server (seeds demo data if needed and runs migrations)
npm run start:prod
```

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | System overview, inventory metrics, overdue loans, open alerts, and quick actions. |
| **Catalog** | `/catalog` | Management of categories, storage locations, and organization units. |
| **Assets** | `/assets` | Search, filter, add, edit, track, and export physical equipment. |
| **Issues & Loans** | `/issues` | Issue equipment, check-in returns, renew active loans, or report lost items. |
| **Transfers** | `/transfers` | Transfer asset custody between different departments or units. |
| **Alerts** | `/alerts` | View, filter, acknowledge, and resolve low-stock and overdue alerts. |
| **Purchases** | `/purchases` | Record vendor equipment orders and restocks. |
| **Vendors** | `/vendors` | Supplier directory and contact records. |
| **Drop Boxes** | `/drop-boxes` | Manage physical unassisted drop box collection locations. |
| **Borrower Blocks** | `/blocks` | Block or unblock users with overdue items from borrowing. |
| **Users** | `/users` | User administration and active account statuses. |
| **Audit Log** | `/audit-log` | Immutable compliance log of all database entity mutations. |
| **Reports** | `/reports` | Utilization rates, cost breakdowns, and overdue analytics. |
| **Auth** | `/login`, `/register`, `/forgot-password`, `/reset-password` | User authentication and recovery. |

---

## Role-Based Access Control (RBAC)

| Role | Access Level | Description |
|------|--------------|-------------|
| `super_admin` | **Superadmin** | Full global privileges across all org units; only role permitted to manage user roles and permissions. |
| `org_admin`, `berm_incharge` | **Administrator** | Manage assets, approve checkouts, issue items, and manage workflows restricted to their assigned organization unit. |
| `borrower` | **User** | Browse catalog of available assets and view/manage their own active loans. Default role assigned upon registration. |
| `auditor` | **Auditor** | Read-only access to audit logs, compliance history, and administrative reports. |

---

## Testing

```bash
# Run unit tests
npm test tests/unit

# Run full integration test suite (requires running database)
npm test

# Run manual workflow test scripts
node scripts/manual-tests/test-complete-auth.js
node scripts/manual-tests/test-borrowing-workflow.js
```
