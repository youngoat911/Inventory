// src/modules/borrower-blocks/borrower-blocks.schemas.js
import { z } from 'zod';

export const createBlockSchema = z.object({
  user_id: z.string().uuid(),
  issue_id: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(500),
  blocked_by: z.string().uuid(),
  blocked_until: z.string().date().optional(),
  is_active: z.boolean().optional(),
});

export const updateBlockSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
  blocked_until: z.string().date().optional(),
  is_active: z.boolean().optional(),
  lifted_by: z.string().uuid().optional(),
  lifted_at: z.string().date().optional(),
});

export const blockIdSchema = z.object({
  id: z.string().uuid(),
});

export const userIdSchema = z.object({
  userId: z.string().uuid(),
});

export const listBlocksSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  user_id: z.string().uuid().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  blocked_until: z.string().date().optional(),
});