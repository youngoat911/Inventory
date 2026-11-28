import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  idSchema,
  listQuerySchema,
} from './categories.schemas.js';
import * as controller from './categories.controller.js';
import { requireReadAccess, requireSuperAdmin } from '../../middleware/authorize.js';

const router = Router();
router.use(requireReadAccess);

router.get('/', validate(listQuerySchema, 'query'), controller.list);
router.get('/tree', controller.getTree);
router.post('/', requireSuperAdmin, validate(createCategorySchema, 'body'), controller.create);
router.get('/:id', validate(idSchema, 'params'), controller.getById);
router.get('/:id/path', validate(idSchema, 'params'), controller.getPath);
router.get('/:id/children', validate(idSchema, 'params'), controller.getChildren);
router.patch('/:id', requireSuperAdmin, validate(idSchema, 'params'), validate(updateCategorySchema, 'body'), controller.update);
router.delete('/:id', requireSuperAdmin, validate(idSchema, 'params'), controller.deleteById);

export default router;
