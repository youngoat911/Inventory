import { pool } from '../../db/pool.js';

export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO purchases (purchase_order_no, vendor_id, org_unit_id, purchase_date, invoice_no, invoice_date, 
                           total_amount, tax_amount, shipping_cost, other_charges, grand_total, payment_status, 
                           payment_method, payment_date, payment_reference, warranty_months, notes, purchased_by, approved_by,
                           budget_type, budget_head)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     RETURNING *`,
    [
      data.purchase_order_no,
      data.vendor_id,
      data.org_unit_id,
      data.purchase_date,
      data.invoice_no || null,
      data.invoice_date || null,
      data.total_amount,
      data.tax_amount || 0,
      data.shipping_cost || 0,
      data.other_charges || 0,
      data.grand_total,
      data.payment_status || 'pending',
      data.payment_method || null,
      data.payment_date || null,
      data.payment_reference || null,
      data.warranty_months || 0,
      data.notes || null,
      data.purchased_by,
      data.approved_by || null,
      data.budget_type || null,
      data.budget_head || null
    ]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT p.*, 
            v.name as vendor_name,
            v.code as vendor_code,
            org.name as org_unit_name,
            u1.full_name as purchased_by_name,
            u2.full_name as approved_by_name
     FROM purchases p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     LEFT JOIN org_units org ON p.org_unit_id = org.id
     LEFT JOIN users u1 ON p.purchased_by = u1.id
     LEFT JOIN users u2 ON p.approved_by = u2.id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0];
}

export async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.vendor_id) {
    paramCount++;
    conditions.push(`p.vendor_id = $${paramCount}`);
    values.push(filters.vendor_id);
  }

  if (filters.org_unit_id) {
    paramCount++;
    conditions.push(`p.org_unit_id = $${paramCount}`);
    values.push(filters.org_unit_id);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`p.org_unit_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  if (filters.budget_type) {
    paramCount++;
    conditions.push(`p.budget_type = $${paramCount}`);
    values.push(filters.budget_type);
  }

  if (filters.payment_status) {
    paramCount++;
    conditions.push(`p.payment_status = $${paramCount}`);
    values.push(filters.payment_status);
  }

  if (filters.from_date) {
    paramCount++;
    conditions.push(`p.purchase_date >= $${paramCount}`);
    values.push(filters.from_date);
  }

  if (filters.to_date) {
    paramCount++;
    conditions.push(`p.purchase_date <= $${paramCount}`);
    values.push(filters.to_date);
  }

  if (filters.search) {
    paramCount++;
    conditions.push(`(p.purchase_order_no ILIKE $${paramCount} OR p.invoice_no ILIKE $${paramCount})`);
    values.push(`%${filters.search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT p.*,
            v.name as vendor_name,
            org.name as org_unit_name,
            u.full_name as purchased_by_name,
            COUNT(*) OVER() as total_count
     FROM purchases p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     LEFT JOIN org_units org ON p.org_unit_id = org.id
     LEFT JOIN users u ON p.purchased_by = u.id
     ${whereClause}
     ORDER BY p.purchase_date DESC, p.created_at DESC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...values, filters.limit, filters.offset]
  );

  return {
    items: rows,
    total: rows.length > 0 ? parseInt(rows[0].total_count) : 0,
  };
}

export async function update(id, fields) {
  const allowed = ['purchase_order_no', 'vendor_id', 'org_unit_id', 'purchase_date', 'invoice_no', 'invoice_date',
                   'total_amount', 'tax_amount', 'shipping_cost', 'other_charges', 'grand_total', 'payment_status',
                   'payment_method', 'payment_date', 'payment_reference', 'warranty_months', 'notes', 'approved_by',
                   'budget_type', 'budget_head'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  
  if (entries.length === 0) {
    return getById(id);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE purchases 
     SET ${assignments.join(', ')}, updated_at = now() 
     WHERE id = $${values.length} 
     RETURNING *`,
    values
  );

  return rows[0];
}

export async function deleteById(id) {
  const { rows } = await pool.query(
    'DELETE FROM purchases WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

export async function getByPurchaseOrderNo(orderNo) {
  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE purchase_order_no = $1',
    [orderNo]
  );
  return rows[0];
}

export async function getVendorById(vendorId) {
  const { rows } = await pool.query(
    'SELECT * FROM vendors WHERE id = $1',
    [vendorId]
  );
  return rows[0];
}

export async function getOrgUnitById(orgUnitId) {
  const { rows } = await pool.query(
    'SELECT * FROM org_units WHERE id = $1',
    [orgUnitId]
  );
  return rows[0];
}

// Purchase Items
export async function addItem(data) {
  const { rows } = await pool.query(
    `INSERT INTO purchase_items (purchase_id, asset_id, description, category_id, quantity, unit_price, total_price, serial_numbers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.purchase_id,
      data.asset_id || null,
      data.description,
      data.category_id || null,
      data.quantity,
      data.unit_price,
      data.total_price,
      data.serial_numbers || null
    ]
  );
  return rows[0];
}

export async function getItems(purchaseId) {
  const { rows } = await pool.query(
    `SELECT pi.*, 
            c.name as category_name,
            a.name as asset_name
     FROM purchase_items pi
     LEFT JOIN categories c ON pi.category_id = c.id
     LEFT JOIN assets a ON pi.asset_id = a.id
     WHERE pi.purchase_id = $1
     ORDER BY pi.created_at`,
    [purchaseId]
  );
  return rows;
}

export async function getItemById(itemId) {
  const { rows } = await pool.query(
    'SELECT * FROM purchase_items WHERE id = $1',
    [itemId]
  );
  return rows[0];
}

export async function updateItem(itemId, fields) {
  const allowed = ['asset_id', 'description', 'category_id', 'quantity', 'unit_price', 'total_price', 'serial_numbers'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  
  if (entries.length === 0) {
    return getItemById(itemId);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(itemId);

  const { rows } = await pool.query(
    `UPDATE purchase_items 
     SET ${assignments.join(', ')} 
     WHERE id = $${values.length} 
     RETURNING *`,
    values
  );

  return rows[0];
}

export async function deleteItem(itemId) {
  const { rows } = await pool.query(
    'DELETE FROM purchase_items WHERE id = $1 RETURNING *',
    [itemId]
  );
  return rows[0];
}
