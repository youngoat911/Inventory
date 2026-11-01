import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as schemas from './notifications.schemas.js';
import * as controller from './notifications.controller.js';

const router = Router();
router.get('/', validate(schemas.listNotificationsSchema, 'query'), controller.list);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', validate(schemas.notificationIdSchema, 'params'), controller.markRead);

export default router;