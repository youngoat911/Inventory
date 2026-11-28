import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { 
  orgIdSchema,
  assetInventoryQuerySchema,
  borrowingHistoryQuerySchema,
  overdueLoansQuerySchema,
  maintenanceCostsQuerySchema,
  disposalSummaryQuerySchema,
  verificationProgressQuerySchema,
  assetUtilizationQuerySchema,
  depreciationQuerySchema
} from './reports.schemas.js';
import * as controller from './reports.controller.js';
import { requireAdmin, requireAssignedOrg, requireRole } from '../../middleware/authorize.js';

const router = Router();
router.use(requireRole('super_admin', 'org_admin', 'berm_incharge', 'borrower', 'auditor'));
router.use('/reports', requireRole('super_admin', 'org_admin', 'berm_incharge', 'auditor'));

// Dashboard routes
router.get('/dashboard/summary', controller.getDashboardSummary);
router.get('/dashboard/org/:orgId', requireAdmin, validate(orgIdSchema, 'params'), requireAssignedOrg((req) => [req.validated.params.orgId]), controller.getOrgDashboard);

// Report routes
router.get('/reports/asset-inventory', validate(assetInventoryQuerySchema, 'query'), controller.getAssetInventoryReport);
router.get('/reports/borrowing-history', validate(borrowingHistoryQuerySchema, 'query'), controller.getBorrowingHistoryReport);
router.get('/reports/overdue-loans', validate(overdueLoansQuerySchema, 'query'), controller.getOverdueLoansReport);
router.get('/reports/maintenance-costs', validate(maintenanceCostsQuerySchema, 'query'), controller.getMaintenanceCostsReport);
router.get('/reports/disposal-summary', validate(disposalSummaryQuerySchema, 'query'), controller.getDisposalSummaryReport);
router.get('/reports/verification-progress', validate(verificationProgressQuerySchema, 'query'), controller.getVerificationProgressReport);
router.get('/reports/asset-utilization', validate(assetUtilizationQuerySchema, 'query'), controller.getAssetUtilizationReport);
router.get('/reports/depreciation', requireRole('super_admin', 'org_admin', 'auditor'), validate(depreciationQuerySchema, 'query'), controller.getDepreciationReport);

export default router;
