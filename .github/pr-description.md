### Overview

This pull request refactors and modernizes the project architecture into a clean, modular structure. It organizes domain modules, eliminates routing clutter, consolidates authentication logic, cleans up root-level test scripts, establishes automated CI testing, and aligns documentation—all while preserving 100% backward compatibility with existing tests and imports.

---

### Key Changes

#### 1. Modular Auth Architecture
- Created `src/modules/auth/` containing dedicated `auth.controller.js` and `auth.routes.js`, bringing authentication in line with the rest of the domain-driven modules.
- Kept `src/controllers/auth.controller.js` and `src/routes/auth.routes.js` as lightweight backward-compatible facades to prevent breaking existing imports.

#### 2. Centralized API Router (`src/routes/api.routes.js`)
- Created a single entry point router for `/api/v1` that mounts all domain modules (`auth`, `users`, `roles`, `assets`, `issues`, `transfers`, `alerts`, `purchases`, `vendors`, `audit-log`, `reports`, etc.).
- Cleaned up `src/app.js`, reducing it from 20+ direct module router declarations down to mounting the unified API router alongside global middleware.

#### 3. Middleware Consolidation
- Centralized the PASETO authentication middleware under `src/middleware/authenticate.js`.
- Preserved `src/middlewares/auth.middleware.js` as a compatibility re-export for existing integration tests.

#### 4. Directory & Module Normalization
- Standardized module naming with kebab-case aliases (`src/modules/org-units/` and `src/modules/blocks/`) matching existing modules like `borrower-blocks`, `drop-boxes`, and `audit-log`.
- Removed redundant deployment configs (`frontend/vercel.json`, `frontend/.oxlintrc.json`).

#### 5. Scripts Reorganization & Fixes (`scripts/`)
- Relocated all 8 standalone test scripts (`test-*.js`) into `scripts/manual-tests/` to keep the root directory clean.
- Fixed relative import paths in all manual test scripts (`../../src/...`) resolving module resolution failures (`ERR_MODULE_NOT_FOUND`).
- Consolidated utility scripts under `scripts/`: demo data seeding (`seed-demo-data.js`), deployment checks (`deployment-check.js`), and user creation helpers (`create-test-user.js`).

#### 6. GitHub Actions CI Workflow (`.github/workflows/ci.yml`)
- Added comprehensive CI pipeline with 3 parallel/staged jobs:
  - **Lint & Build**: Node 22 setup, backend dependency caching, and frontend production build (`npm run build:frontend`).
  - **Unit Tests**: Executes unit test suite (`npm test tests/unit`).
  - **Integration Tests**: Automated PostgreSQL 16 Alpine service container with health checks, automatic migration run (`npm run db:migrate`), and integration test suite execution.
- Configured triggers for `main` and feature/refactor branches on both push and pull request.

#### 7. Test Suite Stabilization (`vitest.config.js`)
- Created `vitest.config.js` with `fileParallelism: false` to eliminate database race conditions where concurrent test teardowns clobbered shared test users and records.
- Achieved **100% test pass rate** across both unit and integration suites (65 of 65 tests passing).

#### 8. Documentation & Local Setup
- Updated root `README.md` and `frontend/README.md` with accurate ASCII directory trees, complete frontend route listings, RBAC privilege matrix, and development workflow commands.
- Added native PostgreSQL setup guide (user role, database creation, and credentials) for contributors running without Docker.

---

### Verification & Test Results

- **All Tests (65/65 passed)**:
  - Unit Tests: `tests/unit/authorize.test.js` (5/5 passed)
  - Integration Tests: `tests/integration/assets.test.js` (14/14 passed)
  - Integration Tests: `tests/integration/audit-log.test.js` (10/10 passed)
  - Integration Tests: `tests/integration/reports.test.js` (22/22 passed)
  - Integration Tests: `tests/integration/security.test.js` (14/14 passed)
- **Frontend Production Build**: Clean build with zero warnings or errors (`npm run build:frontend`).
- **Database Migrations**: Ran all 12 migrations successfully via `npm run db:migrate`.
- **Backward Compatibility**: All previous module paths, routes, and controllers remain intact.
