import { z } from 'zod';

export const listMaintenanceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const maintenanceIdSchema = z.object({ id: z.string().uuid() });
export const createMaintenanceSchema = z.object({
  asset_id: z.string().uuid(),
  type: z.enum(['repair', 'preventive', 'inspection', 'calibration', 'upgrade', 'other']).default('repair'),
  description: z.string().trim().min(1).max(2000),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
});