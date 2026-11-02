import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { 
  createOrgUnitSchema, 
  updateOrgUnitSchema, 
  idSchema,
  listQuerySchema 
} from './org_units.schemas.js';
import * as controller from './org_units.controller.js';
import {
  requireAssignedOrg,
  requireReadAccess,
  requireSuperAdmin,
} from '../../middleware/authorize.js';

const router = Router();
router.use(requireReadAccess);

router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.post('/', requireSuperAdmin, validate(createOrgUnitSchema, 'body'), controller.create);
router.get('/:id', validate(idSchema, 'params'), requireAssignedOrg((req) => [req.validated.params.id]), controller.getById);
router.patch('/:id', requireSuperAdmin, validate(idSchema, 'params'), validate(updateOrgUnitSchema, 'body'), controller.update);
router.delete('/:id', requireSuperAdmin, validate(idSchema, 'params'), controller.deleteById);
router.get('/:id/children', validate(idSchema, 'params'), requireAssignedOrg((req) => [req.validated.params.id]), controller.getChildren);

export default router;
