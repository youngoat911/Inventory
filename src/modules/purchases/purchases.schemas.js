import { z } from 'zod';
import { BUDGET_TYPES } from '../../config/constants.js';

export const createPurchaseSchema = z.object({
  purchase_order_no: z.string().trim().min(1, 'Purchase order number is required'),
  vendor_id: z.string().uuid('Valid vendor ID is required'),
  org_unit_id: z.string().uuid('Valid organization unit ID is required'),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  invoice_no: z.string().trim().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_amount: z.number().positive('Total amount must be positive'),
  tax_amount: z.number().min(0).default(0),
  shipping_cost: z.number().min(0).default(0),
  other_charges: z.number().min(0).default(0),
  grand_total: z.number().positive().optional(),
  payment_status: z.enum(['pending', 'partial', 'paid']).default('pending'),
  payment_method: z.enum(['bank_transfer', 'cheque', 'cash', 'card', 'upi']).optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_reference: z.string().trim().optional(),
  warranty_months: z.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
  approved_by: z.string().uuid().optional(),
  budget_type: z.enum(BUDGET_TYPES).optional(),
  budget_head: z.string().trim().optional(),
});

export const updatePurchaseSchema = z.object({
  purchase_order_no: z.string().trim().min(1).optional(),
  vendor_id: z.string().uuid().optional(),
  org_unit_id: z.string().uuid().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoice_no: z.string().trim().nullable().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  total_amount: z.number().positive().optional(),
  tax_amount: z.number().min(0).optional(),
  shipping_cost: z.number().min(0).optional(),
  other_charges: z.number().min(0).optional(),
  grand_total: z.number().positive().optional(),
  payment_status: z.enum(['pending', 'partial', 'paid']).optional(),
  payment_method: z.enum(['bank_transfer', 'cheque', 'cash', 'card', 'upi']).nullable().optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  payment_reference: z.string().trim().nullable().optional(),
  warranty_months: z.number().int().min(0).optional(),
  notes: z.string().trim().nullable().optional(),
  approved_by: z.string().uuid().nullable().optional(),
  budget_type: z.enum(BUDGET_TYPES).nullable().optional(),
  budget_head: z.string().trim().nullable().optional(),
});

export const addPurchaseItemSchema = z.object({
  asset_id: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Description is required'),
  category_id: z.string().uuid().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive'),
  serial_numbers: z.array(z.string()).optional(),
});

export const updatePurchaseItemSchema = z.object({
  asset_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).optional(),
  category_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  unit_price: z.number().positive().optional(),
  serial_numbers: z.array(z.string()).nullable().optional(),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const itemIdSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  vendor_id: z.string().uuid().optional(),
  org_unit_id: z.string().uuid().optional(),
  payment_status: z.enum(['pending', 'partial', 'paid']).optional(),
  budget_type: z.enum(BUDGET_TYPES).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
});
