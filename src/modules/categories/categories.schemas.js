import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  parent_id: z.string().uuid('Invalid parent category ID').nullable().optional(),
  level: z.number().int().min(1).max(5).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  sort_order: z.number().int().min(0).default(0),
  default_low_stock_threshold: z.number().int().min(0).default(0),
  default_loan_days: z.number().int().min(1, 'Default loan days must be at least 1').default(7),
  max_renewals: z.number().int().min(0).default(0),
  dep_rate_percent: z.number().min(0).max(100).nullable().optional(),
  amortization_life_years: z.number().int().positive().nullable().optional(),
  dep_method: z.string().trim().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  parent_id: z.string().uuid('Invalid parent category ID').nullable().optional(),
  level: z.number().int().min(1).max(5).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  sort_order: z.number().int().min(0).optional(),
  default_low_stock_threshold: z.number().int().min(0).optional(),
  default_loan_days: z.number().int().min(1).optional(),
  max_renewals: z.number().int().min(0).optional(),
  dep_rate_percent: z.number().min(0).max(100).nullable().optional(),
  amortization_life_years: z.number().int().positive().nullable().optional(),
  dep_method: z.string().trim().optional(),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  parent_id: z.union([z.string().uuid(), z.literal('null')]).optional(),
  level: z.coerce.number().int().min(1).max(4).optional(),
  is_legacy: z.coerce.boolean().optional(),
  search: z.string().optional(),
});
