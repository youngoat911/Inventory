// src/modules/transfers/transfers.schemas.js
import { z } from 'zod';

// Transfer status enum
const transferStatusEnum = z.enum(['requested', 'approved', 'rejected', 'completed', 'cancelled']);

// Create transfer schema
export const createTransferSchema = z.object({
  asset_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  from_org_id: z.string().uuid().optional(),
  to_org_id: z.string().uuid().optional(),
  from_location_id: z.string().uuid().optional(),
  to_location_id: z.string().uuid().optional(),
  from_user_id: z.string().uuid().optional(),
  to_user_id: z.string().uuid().optional(),
  to_issued_to: z.string().trim().max(255).optional(),
  to_incharge_name: z.string().trim().max(255).optional(),
  to_incharge_phone: z.string().trim().max(30).optional(),
  reason: z.string().trim().min(1).max(1000),
});

// List transfers query schema
export const listTransfersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: transferStatusEnum.optional(),
  asset_id: z.string().uuid().optional(),
  from_org_id: z.string().uuid().optional(),
  to_org_id: z.string().uuid().optional(),
  sort: z.string().optional(),
});

// Transfer ID param schema
export const transferIdSchema = z.object({
  id: z.string().uuid(),
});

// Update transfer schema (before approval)
export const updateTransferSchema = z.object({
  quantity: z.number().int().positive().optional(),
  from_org_id: z.string().uuid().optional(),
  to_org_id: z.string().uuid().optional(),
  from_location_id: z.string().uuid().optional(),
  to_location_id: z.string().uuid().optional(),
  from_user_id: z.string().uuid().optional(),
  to_user_id: z.string().uuid().optional(),
  to_issued_to: z.string().trim().max(255).optional(),
  to_incharge_name: z.string().trim().max(255).optional(),
  to_incharge_phone: z.string().trim().max(30).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

// Approve transfer schema
export const approveTransferSchema = z.object({
  approved_by: z.string().uuid().optional(), // Optional: defaults to authenticated user
});

// Reject transfer schema
export const rejectTransferSchema = z.object({
  rejected_by: z.string().uuid().optional(), // Optional: defaults to authenticated user
  rejection_reason: z.string().trim().min(1).max(1000),
});

// Complete transfer schema
export const completeTransferSchema = z.object({
  completed_by: z.string().uuid().optional(), // Optional: defaults to authenticated user
});

// Cancel transfer schema
export const cancelTransferSchema = z.object({
  cancellation_reason: z.string().trim().min(1).max(1000),
});
