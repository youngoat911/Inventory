import { z } from 'zod';

const kind = z.enum(['status', 'condition']);
const color = z.enum(['ok', 'info', 'warn', 'danger', 'neutral']);

export const kindParamSchema = z.object({ kind });

export const itemParamSchema = z.object({
  kind,
  code: z.string().min(1),
});

export const listQuerySchema = z.object({
  include_inactive: z.coerce.boolean().optional(),
});

export const createSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{0,49}$/, 'Code must start with a letter and use only lowercase letters, digits, and underscores')
    .optional(),
  label: z.string().trim().min(1, 'Label is required').max(80),
  color: color.default('neutral'),
  sort_order: z.number().int().min(0).optional(),
});

export const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  color: color.optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});
