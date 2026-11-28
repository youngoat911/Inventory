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
│       ├── categories/                  # 4-level hierarchical asset classification (19 fixed Level 1 + L2–L4 sub-categories)
│       ├── disposals/                   # Asset disposal requests and approvals
│       ├── drop-boxes/                  # Physical return drop box endpoints
│       ├── issues/                      # Asset checkouts, returns, renewals & loan lifecycle
│       ├── locations/                   # Physical storage & warehouse locations
│       ├── maintenance/                 # Asset maintenance tracking
│       ├── org-units/                   # Campus/organization units & departments
│       ├── notifications/               # User notifications and read status
│       ├── purchases/                   # Asset acquisition records & vendor purchases
│       ├── reports/                     # Utilization, overdue loans & cost analytics
│       ├── roles/                       # System RBAC roles & user assignments
│       ├── transfers/                   # Custody transfers between organization units
│       ├── users/                       # User management & account statuses
│       ├── verifications/               # Inventory verification cycles
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
│   ├── seed-default-data.js             # Starter administrator and inventory seeder
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

To add a starter administrator, catalog, location, and sample asset to a local database, set `SEED_ADMIN_PASSWORD` in `.env` and run:
```bash
npm run db:seed:default
```

To seed demo data (creates sample users, roles, categories, locations, assets, and active loans):
```bash
# Local development:
npm run db:seed:demo

# For manual execution against a remote database (e.g. Render):
npm run db:seed:demo -- --confirm-render
```

`npm run start:prod` runs migrations and seeds demo inventory before starting the API. Set the Render service's Start Command to `npm run start:prod` to seed on deployment. For a manual run from your machine against Render, set `DATABASE_URL` to the external database URL and use the `--confirm-render` command above.

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
| **Catalog** | `/catalog` | Expandable 4-level asset classification tree (19 fixed Level 1 categories + super-admin-managed Levels 2–4), storage locations, organization units, and drop boxes. |
| **Assets** | `/assets` | Search, filter, add, edit, track, and export physical equipment. |
| **Issues & Loans** | `/issues` | Issue equipment, check-in returns, renew active loans, or report lost items. |
| **Transfers** | `/transfers` | Transfer asset custody between different departments or units. |
| **Disposals** | `/disposals` | Submit and review asset disposal requests. |
| **Maintenance** | `/maintenance` | Track and resolve asset maintenance. |
| **Alerts** | `/alerts` | View, filter, acknowledge, and resolve low-stock and overdue alerts. |
| **Notifications** | `/notifications` | View notifications and mark them as read. |
| **Purchases** | `/purchases` | Record vendor equipment orders and restocks. |
| **Vendors** | `/vendors` | Supplier directory and contact records. |
| **Drop Boxes** | `/drop-boxes` | Manage physical unassisted drop box collection locations. |
| **Borrower Blocks** | `/blocks` | Block or unblock users with overdue items from borrowing. |
| **Verifications** | `/verifications` | Create and manage inventory verification cycles. |
| **Users** | `/users` | User administration and active account statuses. |
| **Audit Log** | `/audit-log` | Immutable compliance log of all database entity mutations. |
| **Reports** | `/reports` | Utilization rates, cost breakdowns, and overdue analytics. |
| **Auth** | `/login`, `/register`, `/forgot-password`, `/reset-password` | User authentication and recovery. |

---

## Asset Classification Hierarchy

Assets are classified using a **4-level hierarchy** (`Level 1 → Level 2 → Level 3 → Level 4`). Assets must be assigned to a **leaf sub-category** (Levels 2–4 with no children).

- **Level 1 (Fixed & Read-Only):** 19 government asset categories seeded by migration (`01` Land through `19` Patents):
  1. `01` Land
  2. `02` Site Development
  3. `03` Buildings
  4. `04` Roads and Bridges
  5. `05` Tubewell & Water Supply
  6. `06` Sewage and Drainage
  7. `07` Electrical Installation and Equipment
  8. `08` Plant and Machinery
  9. `09` Scientific and Laboratory Equipment
  10. `10` Office Equipment
  11. `11` Audio Visual Equipment
  12. `12` Computers and Peripherals
  13. `13` Furniture, Fixtures and Fittings
  14. `14` Vehicles
  15. `15` Library Books
  16. `16` Small Value Assets
  17. `17` Computer Software
  18. `18` E-Journals
  19. `19` Patents
- **Levels 2–4:** Managed exclusively by `super_admin` via `/catalog`.

### Depreciation Rates & Calculation Rules

> Note: These rates and rules follow the Ministry of Education format for Central Higher Educational Institutions (*Schedule 4 - Fixed Assets*). Each institute should verify and configure its own accounting policy as needed.

- **Method:** Straight-Line Method (SLM) on original `cost` (`annual_dep = cost * effective_rate / 100`).
- **Financial Year:** 1 April to 31 March (`GET /api/v1/reports/depreciation?fy=YYYY-YY`).
- **Full-Year Charge:** Full-year depreciation is charged in the financial year of `capitalization_date` regardless of the month (no pro-rata).
- **Residual Value:** Depreciation stops when book value reaches **₹1** (except **Small Value Assets**, which depreciate 100% in the year of acquisition to **₹0** residual; `SMALL_VALUE_ASSET_LIMIT = 2000` is shown as a form hint).
- **Land & Site Development:** 0% depreciation (book value remains equal to cost).
- **Disposed Assets:** Stop depreciating starting from the financial year of disposal.
- **Inheritance:** Only Level 1 categories carry a rate; Levels 2–4 inherit their Level 1 ancestor's rate.

| Code | Level 1 Category | Rate / Life |
|------|------------------|-------------|
| `01` | Land | 0% |
| `02` | Site Development | 0% |
| `03` | Buildings | 2% |
| `04` | Roads and Bridges | 2% |
| `05` | Tubewell & Water Supply | 2% |
| `06` | Sewage and Drainage | 2% |
| `07` | Electrical Installation and Equipment | 5% |
| `08` | Plant and Machinery | 5% |
| `09` | Scientific and Laboratory Equipment | 8% |
| `10` | Office Equipment | 7.5% |
| `11` | Audio Visual Equipment | 7.5% |
| `12` | Computers and Peripherals | 20% |
| `13` | Furniture, Fixtures and Fittings | 7.5% |
| `14` | Vehicles | 10% |
| `15` | Library Books | 10% |
| `16` | Small Value Assets | 100% |
| `17` | Computer Software | 40% |
| `18` | E-Journals | 40% |
| `19` | Patents | 9 years (11.111%) |

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
