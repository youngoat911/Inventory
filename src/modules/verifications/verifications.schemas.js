import { z } from 'zod';

export const listCyclesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const createCycleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  org_unit_id: z.string().uuid(),
  starts_on: z.string().date(),
  ends_on: z.string().date(),
});
export const cycleIdSchema = z.object({ id: z.string().uuid() });