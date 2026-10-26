import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import authenticate from '../middleware/authenticate.js';

import usersRouter from '../modules/users/users.routes.js';
import orgUnitsRouter from '../modules/org-units/org_units.routes.js';
import categoriesRouter from '../modules/categories/categories.routes.js';
import locationsRouter from '../modules/locations/locations.routes.js';
import vendorsRouter from '../modules/vendors/vendors.routes.js';
import purchasesRouter from '../modules/purchases/purchases.routes.js';
import assetsRouter from '../modules/assets/assets.routes.js';
import issuesRouter from '../modules/issues/issues.routes.js';
import dropBoxesRouter from '../modules/drop-boxes/drop-boxes.routes.js';
import borrowerBlocksRouter from '../modules/borrower-blocks/borrower-blocks.routes.js';
import auditLogRouter from '../modules/audit-log/audit-log.routes.js';
import reportsRouter from '../modules/reports/reports.routes.js';
import alertsRouter from '../modules/alerts/alerts.routes.js';
import transfersRouter from '../modules/transfers/transfers.routes.js';
import rolesRouter from '../modules/roles/roles.routes.js';

const router = express.Router();

// Public auth endpoints: /api/v1/auth/*
router.use('/auth', authRoutes);

// Protected endpoints
router.get('/users/me', authenticate, (req, res) => {
  res.status(200).json({ data: req.user });
});

router.use('/users', authenticate, usersRouter);
router.use('/org-units', authenticate, orgUnitsRouter);
router.use('/categories', authenticate, categoriesRouter);
router.use('/locations', authenticate, locationsRouter);
router.use('/vendors', authenticate, vendorsRouter);
router.use('/purchases', authenticate, purchasesRouter);
router.use('/assets', authenticate, assetsRouter);
router.use('/issues', authenticate, issuesRouter);
router.use('/drop-boxes', authenticate, dropBoxesRouter);
router.use('/blocks', authenticate, borrowerBlocksRouter);
router.use('/audit-log', authenticate, auditLogRouter);
router.use('/alerts', authenticate, alertsRouter);
router.use('/transfers', authenticate, transfersRouter);
router.use('/roles', authenticate, rolesRouter);
router.use('/', authenticate, reportsRouter);

export default router;
