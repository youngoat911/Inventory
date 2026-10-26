import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAdmin, requireReadAccess, requireRole, requireScopedBodyResource, requireScopedResource } from '../../middleware/authorize.js';
import * as schemas from './disposals.schemas.js';
import * as controller from './disposals.controller.js';

const router = Router();
router.use(requireReadAccess);
router.get('/', validate(schemas.listDisposalsSchema, 'query'), controller.list);
router.post('/', requireRole('super_admin', 'org_admin', 'berm_incharge', 'borrower'), validate(schemas.createDisposalSchema, 'body'), requireScopedBodyResource('asset', 'asset_id'), controller.create);
router.get('/:id', validate(schemas.disposalIdSchema, 'params'), requireScopedResource('disposal'), controller.getById);
router.post('/:id/approve', requireAdmin, validate(schemas.disposalIdSchema, 'params'), requireScopedResource('disposal'), controller.approve);
router.post('/:id/reject', requireAdmin, validate(schemas.disposalIdSchema, 'params'), requireScopedResource('disposal'), validate(schemas.rejectDisposalSchema, 'body'), controller.reject);

export default router;