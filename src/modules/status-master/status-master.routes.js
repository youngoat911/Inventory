import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAdmin, requireReadAccess } from '../../middleware/authorize.js';
import {
  kindParamSchema,
  itemParamSchema,
  listQuerySchema,
  createSchema,
  updateSchema,
} from './status-master.schemas.js';
import * as controller from './status-master.controller.js';

const router = Router();
router.use(requireReadAccess);

router.get('/:kind', validate(kindParamSchema, 'params'), validate(listQuerySchema, 'query'), controller.list);
router.post('/:kind', requireAdmin, validate(kindParamSchema, 'params'), validate(createSchema, 'body'), controller.create);
router.patch('/:kind/:code', requireAdmin, validate(itemParamSchema, 'params'), validate(updateSchema, 'body'), controller.update);
router.delete('/:kind/:code', requireAdmin, validate(itemParamSchema, 'params'), controller.remove);

export default router;
