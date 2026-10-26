// src/modules/borrower-blocks/borrower-blocks.routes.js
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import {
  createBlockSchema,
  updateBlockSchema,
  blockIdSchema,
  userIdSchema,
  listBlocksSchema,
} from './borrower-blocks.schemas.js';
import * as controller from './borrower-blocks.controller.js';
import {
  requireAdmin,
  requireScopedBodyResource,
  requireScopedResource,
} from '../../middleware/authorize.js';

const router = Router();
router.use(requireAdmin);

// CRUD routes
router.get('/', validate(listBlocksSchema, 'query'), controller.listBorrowerBlocks);
router.post('/', validate(createBlockSchema, 'body'), requireScopedBodyResource('user', 'user_id'), requireScopedBodyResource('issue', 'issue_id'), controller.createBorrowerBlock);
router.get('/active/:userId', validate(userIdSchema, 'params'), requireScopedResource('user', 'userId'), controller.getActiveBlocksForUser);
router.get('/:id', validate(blockIdSchema, 'params'), requireScopedResource('block'), controller.getBlockById);
router.patch('/:id', validate(blockIdSchema, 'params'), requireScopedResource('block'), validate(updateBlockSchema, 'body'), controller.updateBorrowerBlock);
router.delete('/:id', validate(blockIdSchema, 'params'), requireScopedResource('block'), controller.deleteBorrowerBlock);

export default router;