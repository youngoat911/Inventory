import { z } from 'zod';

export const createOrgUnitSchema = z.object({
  type: z.string().trim().min(1, 'Type is required'),
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().min(1, 'Code is required'),
  parent_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
});

export const updateOrgUnitSchema = z.object({
  type: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  parent_id: z.string().uuid().optional(),
});
