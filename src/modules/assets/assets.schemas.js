import { z } from 'zod';

export const createAssetSchema = z.object({
  asset_tag: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Name is required').max(255),
  description: z.string().trim().optional(),
  category_id: z.string().uuid('Invalid category ID'),
  tracking: z.enum(['individual', 'quantity'], {
    errorMap: () => ({ message: 'Tracking must be either "individual" or "quantity"' })
  }),
  quantity: z.number().int().min(0, 'Quantity must be non-negative').default(1),
  low_stock_threshold: z.number().int().min(0, 'Low stock threshold must be non-negative').default(0),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative').optional(),
  cost: z.number().min(0, 'Cost must be non-negative').optional(),
  capitalization_date: z.string().date('Invalid capitalization date (use YYYY-MM-DD format)').optional(),
  serial_no: z.string().trim().optional(),
  brand_model: z.string().trim().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'under_repair'], {
    errorMap: () => ({ message: 'Invalid condition value' })
  }),
  status: z.enum(['available', 'issued', 'in_maintenance', 'disposed', 'lost', 'reserved'], {
    errorMap: () => ({ message: 'Invalid status value' })
  }),
  owner_org_id: z.string().uuid('Invalid owner organization ID').optional(),
  home_berm_id: z.string().uuid('Invalid BERM ID').optional(),
  location_id: z.string().uuid('Invalid location ID').optional(),
  responsible_user_id: z.string().uuid('Invalid responsible user ID').optional(),
  is_issuable: z.boolean().default(true),
  loan_days_override: z.number().int().min(1, 'Loan days override must be at least 1').optional(),
  purchase_id: z.string().uuid('Invalid purchase ID').optional(),
  warranty_until: z.string().date('Invalid warranty date (use YYYY-MM-DD format)').optional(),
  is_institute_asset: z.boolean().default(true),
});

export const updateAssetSchema = z.object({
  asset_tag: z.string().trim().optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  category_id: z.string().uuid().optional(),
  tracking: z.enum(['individual', 'quantity']).optional(),
  quantity: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
  cost: z.number().min(0).nullable().optional(),
  capitalization_date: z.string().date().nullable().optional(),
  serial_no: z.string().trim().nullable().optional(),
  brand_model: z.string().trim().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'under_repair']).optional(),
  status: z.enum(['available', 'issued', 'in_maintenance', 'disposed', 'lost', 'reserved']).optional(),
  owner_org_id: z.string().uuid().nullable().optional(),
  home_berm_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  responsible_user_id: z.string().uuid().nullable().optional(),
  is_issuable: z.boolean().optional(),
  loan_days_override: z.number().int().min(1).nullable().optional(),
  purchase_id: z.string().uuid().nullable().optional(),
  warranty_until: z.string().date().nullable().optional(),
  is_institute_asset: z.boolean().optional(),
});

export const batchCreateSchema = z.object({
  assets: z.array(createAssetSchema).min(1, 'At least one asset is required'),
});

export const idSchema = z.object({
  id: z.string().uuid('Invalid asset ID'),
});

export const qrTokenSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().optional(),
  status: z.enum(['available', 'issued', 'in_maintenance', 'disposed', 'lost', 'reserved']).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'under_repair']).optional(),
  tracking: z.enum(['individual', 'quantity']).optional(),
  category_id: z.string().uuid().optional(),
  owner_org_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  responsible_user_id: z.string().uuid().optional(),
  is_issuable: z.coerce.boolean().optional(),
  is_institute_asset: z.coerce.boolean().optional(),
  low_stock: z.coerce.boolean().optional(),
  sort: z.string().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  q: z.string().trim().optional(),
  status: z.enum(['available', 'issued', 'in_maintenance', 'disposed', 'lost', 'reserved']).optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged', 'under_repair']).optional(),
  tracking: z.enum(['individual', 'quantity']).optional(),
  category_id: z.string().uuid().optional(),
  owner_org_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  responsible_user_id: z.string().uuid().optional(),
  is_issuable: z.coerce.boolean().optional(),
  is_institute_asset: z.coerce.boolean().optional(),
  low_stock: z.coerce.boolean().optional(),
});
