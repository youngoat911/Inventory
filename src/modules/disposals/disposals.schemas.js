import { z } from 'zod';

const disposalReason = z.enum(['damaged', 'obsolete', 'lost', 'stolen', 'end_of_life', 'other']);

export const listDisposalsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['proposed', 'approved', 'rejected', 'completed']).optional(),
});

export const disposalIdSchema = z.object({ id: z.string().uuid() });

export const createDisposalSchema = z.object({
  asset_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive().default(1),
  reason: disposalReason,
  details: z.string().trim().max(2000).optional(),
});

export const rejectDisposalSchema = z.object({
  rejection_reason: z.string().trim().min(1).max(1000).optional(),
});