import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAdmin, requireReadAccess, requireScopedBodyResource, requireScopedResource } from '../../middleware/authorize.js';
import * as schemas from './maintenance.schemas.js';
import * as controller from './maintenance.controller.js';

const router = Router();
router.use(requireReadAccess);
router.get('/', validate(schemas.listMaintenanceSchema, 'query'), controller.list);
router.post('/', requireAdmin, validate(schemas.createMaintenanceSchema, 'body'), requireScopedBodyResource('asset', 'asset_id'), controller.create);
router.post('/:id/resolve', requireAdmin, validate(schemas.maintenanceIdSchema, 'params'), requireScopedResource('maintenance'), controller.resolve);

export default router;