// src/modules/transfers/transfers.repository.js
import { pool } from '../../db/pool.js';

/**
 * Create a transfer request
 */
export async function createTransfer(transferData, client = pool) {
  const query = `
    INSERT INTO transfers (
      asset_id, quantity, from_org_id, to_org_id, from_location_id, to_location_id,
      from_user_id, to_user_id, reason, requested_by,
      from_issued_to, to_issued_to, from_incharge_name, to_incharge_name,
      from_incharge_phone, to_incharge_phone, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'requested')
    RETURNING *
  `;
  
  const values = [
    transferData.asset_id,
    transferData.quantity,
    transferData.from_org_id || null,
    transferData.to_org_id || null,
    transferData.from_location_id || null,
    transferData.to_location_id || null,
    transferData.from_user_id || null,
    transferData.to_user_id || null,
    transferData.reason,
    transferData.requested_by,
    transferData.from_issued_to || null,
    transferData.to_issued_to || null,
    transferData.from_incharge_name || null,
    transferData.to_incharge_name || null,
    transferData.from_incharge_phone || null,
    transferData.to_incharge_phone || null,
  ];
  
  const result = await client.query(query, values);
  return result.rows[0];
}

/**
 * Find transfers with filters and pagination
 */
export async function findTransfers({ filters, limit, offset, sort = 't.created_at DESC' }) {
  const conditions = [];
  const params = [];
  let paramCount = 1;

  if (filters.status) {
    conditions.push(`t.status = $${paramCount++}`);
    params.push(filters.status);
  }

  if (filters.asset_id) {
    conditions.push(`t.asset_id = $${paramCount++}`);
    params.push(filters.asset_id);
  }

  if (filters.from_org_id) {
    conditions.push(`t.from_org_id = $${paramCount++}`);
    params.push(filters.from_org_id);
  }

  if (filters.to_org_id) {
    conditions.push(`t.to_org_id = $${paramCount++}`);
    params.push(filters.to_org_id);
  }
  if (filters.org_unit_ids) {
    conditions.push(`(
      t.from_org_id = ANY($${paramCount}::uuid[])
      OR t.to_org_id = ANY($${paramCount}::uuid[])
      OR EXISTS (
        SELECT 1 FROM assets scoped_asset
        WHERE scoped_asset.id = t.asset_id
          AND scoped_asset.owner_org_id = ANY($${paramCount}::uuid[])
      )
    )`);
    params.push(filters.org_unit_ids);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM transfers t JOIN assets a ON a.id = t.asset_id ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get data with joins
  const dataQuery = `
    SELECT 
      t.*,
      a.name as asset_name,
      a.asset_tag,
      from_org.name as from_org_name,
      to_org.name as to_org_name,
      from_loc.name as from_location_name,
      to_loc.name as to_location_name,
      req_user.full_name as requested_by_name,
      appr_user.full_name as approved_by_name,
      rej_user.full_name as rejected_by_name,
      comp_user.full_name as completed_by_name
    FROM transfers t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN org_units from_org ON t.from_org_id = from_org.id
    LEFT JOIN org_units to_org ON t.to_org_id = to_org.id
    LEFT JOIN locations from_loc ON t.from_location_id = from_loc.id
    LEFT JOIN locations to_loc ON t.to_location_id = to_loc.id
    LEFT JOIN users req_user ON t.requested_by = req_user.id
    LEFT JOIN users appr_user ON t.approved_by = appr_user.id
    LEFT JOIN users rej_user ON t.rejected_by = rej_user.id
    LEFT JOIN users comp_user ON t.completed_by = comp_user.id
    ${whereClause}
    ORDER BY ${sort}
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;
  
  const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

  return {
    rows: dataResult.rows,
    total,
  };
}

/**
 * Find transfer by ID
 */
export async function findTransferById(id, client = pool) {
  const query = `
    SELECT 
      t.*,
      a.name as asset_name,
      a.asset_tag,
      a.tracking,
      from_org.name as from_org_name,
      to_org.name as to_org_name,
      from_loc.name as from_location_name,
      to_loc.name as to_location_name,
      req_user.full_name as requested_by_name,
      appr_user.full_name as approved_by_name,
      rej_user.full_name as rejected_by_name,
      comp_user.full_name as completed_by_name
    FROM transfers t
    JOIN assets a ON t.asset_id = a.id
    LEFT JOIN org_units from_org ON t.from_org_id = from_org.id
    LEFT JOIN org_units to_org ON t.to_org_id = to_org.id
    LEFT JOIN locations from_loc ON t.from_location_id = from_loc.id
    LEFT JOIN locations to_loc ON t.to_location_id = to_loc.id
    LEFT JOIN users req_user ON t.requested_by = req_user.id
    LEFT JOIN users appr_user ON t.approved_by = appr_user.id
    LEFT JOIN users rej_user ON t.rejected_by = rej_user.id
    LEFT JOIN users comp_user ON t.completed_by = comp_user.id
    WHERE t.id = $1
  `;
  
  const result = await client.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Update transfer
 */
export async function updateTransfer(id, updateData, client = pool) {
  const allowed = [
    'quantity', 'from_org_id', 'to_org_id', 'from_location_id', 'to_location_id',
    'from_user_id', 'to_user_id', 'reason', 'status', 'approved_by', 'rejected_by',
    'completed_by', 'rejection_reason', 'cancellation_reason', 'approved_at',
    'rejected_at', 'completed_at',
    'to_issued_to', 'to_incharge_name', 'to_incharge_phone'
  ];
  
  const entries = Object.entries(updateData).filter(([key]) => allowed.includes(key));
  
  if (entries.length === 0) {
    return findTransferById(id, client);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);

  const query = `
    UPDATE transfers 
    SET ${assignments.join(', ')}, updated_at = NOW() 
    WHERE id = $${values.length}
    RETURNING *
  `;

  const result = await client.query(query, values);
  return result.rows[0] || null;
}

/**
 * Delete transfer
 */
export async function deleteTransfer(id, client = pool) {
  const result = await client.query(
    'DELETE FROM transfers WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0];
}
