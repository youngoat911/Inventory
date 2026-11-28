import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { 
  createAssetSchema, 
  updateAssetSchema, 
  batchCreateSchema,
  importSchema,
  idSchema,
  qrTokenSchema,
  listQuerySchema,
  exportQuerySchema
} from './assets.schemas.js';
import * as controller from './assets.controller.js';
import {
  assignAdminOrg,
  requireAdmin,
  requireReadAccess,
  requireScopedBodyResource,
  requireScopedResource,
} from '../../middleware/authorize.js';

const router = Router();
router.use(requireReadAccess);

// List and export
router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.get('/export', validate(exportQuerySchema, 'query'), controller.exportAssets);

// QR token resolution
router.get('/qr/:qrToken', validate(qrTokenSchema, 'params'), controller.resolveQRToken);

// CRUD operations
router.post('/', requireAdmin, validate(createAssetSchema, 'body'), assignAdminOrg('owner_org_id'), requireScopedBodyResource('location', 'location_id'), controller.create);
router.post('/import', requireAdmin, validate(importSchema, 'body'), controller.importAssets);
router.post('/batch-create', requireAdmin, validate(batchCreateSchema, 'body'), assignAdminOrg('owner_org_id', 'assets'), controller.batchCreate);
router.get('/:id', validate(idSchema, 'params'), requireScopedResource('asset'), controller.getById);
router.patch('/:id', requireAdmin, validate(idSchema, 'params'), requireScopedResource('asset'), validate(updateAssetSchema, 'body'), controller.update);
router.delete('/:id', requireAdmin, validate(idSchema, 'params'), requireScopedResource('asset'), controller.deleteById);

// QR token generation
router.post('/:id/qr', requireAdmin, validate(idSchema, 'params'), requireScopedResource('asset'), controller.generateQRToken);

export default router;
