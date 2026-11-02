import { pool } from '../../db/pool.js';

export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO org_units (type, name, code, parent_id, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.type, data.name, data.code, data.parent_id || null, data.is_active]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT ou.*, 
            parent.name as parent_name,
            parent.code as parent_code
     FROM org_units ou
     LEFT JOIN org_units parent ON ou.parent_id = parent.id
     WHERE ou.id = $1`,
    [id]
  );
  return rows[0];
}

export async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.type) {
    paramCount++;
    conditions.push(`type = $${paramCount}`);
    values.push(filters.type);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`ou.id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  if (filters.is_active !== undefined) {
    paramCount++;
    conditions.push(`ou.is_active = $${paramCount}`);
    values.push(filters.is_active);
  }

  if (filters.parent_id !== undefined) {
    if (filters.parent_id === null) {
      conditions.push(`ou.parent_id IS NULL`);
    } else {
      paramCount++;
      conditions.push(`ou.parent_id = $${paramCount}`);
      values.push(filters.parent_id);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT ou.*,
            parent.name as parent_name,
            parent.code as parent_code,
            COUNT(*) OVER() as total_count
     FROM org_units ou
     LEFT JOIN org_units parent ON ou.parent_id = parent.id
     ${whereClause}
     ORDER BY ou.created_at DESC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...values, filters.limit, filters.offset]
  );

  return {
    items: rows,
    total: rows.length > 0 ? parseInt(rows[0].total_count) : 0,
  };
}

export async function update(id, fields) {
  const allowed = ['type', 'name', 'code', 'parent_id', 'is_active'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  
  if (entries.length === 0) {
    return getById(id);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE org_units 
     SET ${assignments.join(', ')}, updated_at = now() 
     WHERE id = $${values.length} 
     RETURNING *`,
    values
  );

  return rows[0];
}

export async function deleteById(id) {
  const { rows } = await pool.query(
    'DELETE FROM org_units WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

export async function getChildren(parentId) {
  const { rows } = await pool.query(
    `SELECT * FROM org_units WHERE parent_id = $1 ORDER BY name`,
    [parentId]
  );
  return rows;
}

export async function getByCode(code) {
  const { rows } = await pool.query(
    'SELECT * FROM org_units WHERE code = $1',
    [code]
  );
  return rows[0];
}
