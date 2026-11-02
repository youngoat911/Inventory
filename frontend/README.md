# Gymkhana Inventory Frontend

Responsive single-page application (SPA) built with **React 19** and **Vite 8** for the Gymkhana Inventory API.

---

## Features

- **Authentication & Authorization:** Secure PASETO session management with auto-refresh tokens, protected routes, and role-based views.
- **Dynamic Dashboard:** Real-time summary cards, quick loan actions, low-stock notifications, and retry states.
- **Asset & Catalog Management:** Filterable lists, barcode/tag lookup, category and location filters, and modal dialogues for asset adjustments.
- **Borrowing & Issues Workflow:** Checkouts, returns, extensions/renewals, lost asset tracking, and receipt printing.
- **Alert Center:** Visual severity indicators (`low`, `medium`, `high`, `critical`) with one-click acknowledge and resolve buttons.
- **Responsive Layout:** Adaptive sidebar and mobile drawer navigation with glassmorphism aesthetics.

---

## Project Structure

```
frontend/
├── index.html                           # Entry HTML template
├── vite.config.js                       # Vite configuration (proxies /api to backend)
├── package.json                         # Frontend dependencies (React, Vite, Lucide)
├── src/
│   ├── main.jsx                         # React root bootstrap
│   ├── App.jsx                          # Router and route hierarchy
│   ├── api/
│   │   └── client.js                    # Unified REST client with auth token handling
│   ├── auth/
│   │   ├── AuthContext.jsx              # React context for user sessions & permissions
│   │   └── ProtectedRoute.jsx           # Guard component for role-restricted routes
│   ├── components/                      # Reusable UI primitives
│   │   ├── Layout.jsx                   # Application shell (nav, header, container)
│   │   ├── Modal.jsx                    # Reusable dialog backdrop & panel
│   │   ├── Pagination.jsx               # Page controls
│   │   ├── StatusBadge.jsx              # Status pill badge component
│   │   └── EmptyState.jsx               # Zero-data display placeholder
│   ├── pages/                           # Application route views
│   │   ├── Dashboard.jsx
│   │   ├── Assets.jsx
│   │   ├── Catalog.jsx
│   │   ├── Issues.jsx
│   │   ├── Transfers.jsx
│   │   ├── Alerts.jsx
│   │   ├── Purchases.jsx
│   │   ├── Vendors.jsx
│   │   ├── DropBoxes.jsx
│   │   ├── Blocks.jsx
│   │   ├── Users.jsx
│   │   ├── AuditLog.jsx
│   │   ├── Reports.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── ForgotPassword.jsx
│   │   └── ResetPassword.jsx
│   └── styles/
│       └── app.css                      # Global styles, variables & component CSS
```

---

## Development

The frontend expects the backend API running on `http://localhost:3000`. Vite automatically proxies `/api` and `/health` requests.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## Production Build

To test or generate the production bundle:

```bash
# Build the optimized asset bundle in frontend/dist/
npm run build

# Preview the production build locally
npm run preview
```
