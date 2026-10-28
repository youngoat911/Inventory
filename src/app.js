import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import authenticate from './middlewares/auth.middleware.js';
import { checkDatabase } from './db/pool.js';
import usersRouter from './modules/users/users.routes.js';
import orgUnitsRouter from './modules/org_units/org_units.routes.js';
import categoriesRouter from './modules/categories/categories.routes.js';
import locationsRouter from './modules/locations/locations.routes.js';
import vendorsRouter from './modules/vendors/vendors.routes.js';
import purchasesRouter from './modules/purchases/purchases.routes.js';
import assetsRouter from './modules/assets/assets.routes.js';
import issuesRouter from './modules/issues/issues.routes.js';
import dropBoxesRouter from './modules/drop-boxes/drop-boxes.routes.js';
import borrowerBlocksRouter from './modules/borrower-blocks/borrower-blocks.routes.js';
import auditLogRouter from './modules/audit-log/audit-log.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import alertsRouter from './modules/alerts/alerts.routes.js';
import transfersRouter from './modules/transfers/transfers.routes.js';
import disposalsRouter from './modules/disposals/disposals.routes.js';
import maintenanceRouter from './modules/maintenance/maintenance.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import verificationsRouter from './modules/verifications/verifications.routes.js';
import changeBroadcaster from './middleware/change-broadcaster.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// CORS middleware (set CORS_ORIGIN on Render to your frontend URL to lock this down)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(requestIdMiddleware);
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger({ ignorePaths: [] }));
}

// Health endpoint (no authentication required)
app.get('/health', async (req, res) => {
  try {
    await checkDatabase();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'berm-inventory-api',
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'berm-inventory-api',
      database: 'disconnected',
    });
  }
});

// API status endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BERM API Server',
    version: '1.0.0',
  });
});

// Mount authentication routes under /api/v1/auth
app.use('/api/v1/auth', authRoutes);

// Protected /users/me route (must come before /api/v1/users to avoid conflict)
app.get('/api/v1/users/me', authenticate, (req, res) => {
  res.status(200).json({ data: req.user });
});

// Broadcast real-time notifications on mutations
app.use('/api/v1', changeBroadcaster);

// Mount resource routers
app.use('/api/v1/users', authenticate, usersRouter);
app.use('/api/v1/org-units', authenticate, orgUnitsRouter);
app.use('/api/v1/categories', authenticate, categoriesRouter);
app.use('/api/v1/locations', authenticate, locationsRouter);
app.use('/api/v1/vendors', authenticate, vendorsRouter);
app.use('/api/v1/purchases', authenticate, purchasesRouter);
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use('/api/v1/issues', authenticate, issuesRouter);
app.use('/api/v1/drop-boxes', authenticate, dropBoxesRouter);
app.use('/api/v1/blocks', authenticate, borrowerBlocksRouter);
app.use('/api/v1/audit-log', authenticate, auditLogRouter);
app.use('/api/v1', authenticate, reportsRouter);
app.use('/api/v1/alerts', authenticate, alertsRouter);
app.use('/api/v1/transfers', authenticate, transfersRouter);
app.use('/api/v1/disposals', authenticate, disposalsRouter);
app.use('/api/v1/maintenance', authenticate, maintenanceRouter);
app.use('/api/v1/notifications', authenticate, notificationsRouter);
app.use('/api/v1/verifications', authenticate, verificationsRouter);

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDistPath));

  // Handle client-side routing - serve index.html for all non-API GET routes.
  // Uses app.use (no path) because a bare '*' is invalid in Express 5.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;