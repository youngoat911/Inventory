import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAdmin, requireAssignedOrg } from '../../middleware/authorize.js';
import * as schemas from './verifications.schemas.js';
import * as controller from './verifications.controller.js';

const router = Router();
router.use(requireAdmin);
router.get('/cycles', validate(schemas.listCyclesSchema, 'query'), controller.listCycles);
router.post('/cycles', validate(schemas.createCycleSchema, 'body'), requireAssignedOrg((req) => [req.validated.body.org_unit_id]), controller.createCycle);

export default router;