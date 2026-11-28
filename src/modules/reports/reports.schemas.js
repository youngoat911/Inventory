import { z } from 'zod';

export const orgIdSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
});

export const assetInventoryQuerySchema = z.object({
  org_unit_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const borrowingHistoryQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const overdueLoansQuerySchema = z.object({
  org_unit_id: z.string().uuid().optional(),
});

export const maintenanceCostsQuerySchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const disposalSummaryQuerySchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const verificationProgressQuerySchema = z.object({
  cycle_id: z.string().uuid('Invalid cycle ID'),
});

export const assetUtilizationQuerySchema = z.object({
  org_unit_id: z.string().uuid().optional(),
});

export const depreciationQuerySchema = z.object({
  fy: z.string().regex(/^\d{4}(-\d{2})?$/, 'Use YYYY-YY format (e.g. 2025-26)').optional(),
  org_unit_id: z.string().uuid().optional(),
});
