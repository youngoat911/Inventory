import { pool } from '../../db/pool.js';

export async function list(kind, { includeInactive = false } = {}) {
  const { rows } = await pool.query(
    `SELECT m.*,
            (SELECT COUNT(*)::int FROM assets a
             WHERE (m.kind = 'status' AND a.status = m.code)
                OR (m.kind = 'condition' AND a.condition = m.code)) AS asset_count
     FROM asset_status_master m
     WHERE m.kind = $1 AND ($2::boolean OR m.is_active)
     ORDER BY m.sort_order, m.label`,
    [kind, includeInactive]
  );
  return rows;
}

export async function get(kind, code, client = pool) {
  const { rows } = await client.query(
    'SELECT * FROM asset_status_master WHERE kind = $1 AND code = $2',
    [kind, code]
  );
  return rows[0];
}

export async function nextSortOrder(kind) {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM asset_status_master WHERE kind = $1',
    [kind]
  );
  return rows[0].next;
}

export async function create(kind, data) {
  const { rows } = await pool.query(
    `INSERT INTO asset_status_master (kind, code, label, color, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [kind, data.code, data.label, data.color, data.sort_order]
  );
  return rows[0];
}

export async function update(kind, code, fields) {
  const allowed = ['label', 'color', 'sort_order', 'is_active'];
  const entries = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined);
  if (entries.length === 0) return get(kind, code);
  const sets = entries.map(([k], i) => `${k} = $${i + 3}`);
  const { rows } = await pool.query(
    `UPDATE asset_status_master SET ${sets.join(', ')}, updated_at = now()
     WHERE kind = $1 AND code = $2 RETURNING *`,
    [kind, code, ...entries.map(([, v]) => v)]
  );
  return rows[0];
}

export async function remove(kind, code) {
  await pool.query('DELETE FROM asset_status_master WHERE kind = $1 AND code = $2', [kind, code]);
}

export async function countAssetsUsing(kind, code) {
  const column = kind === 'status' ? 'status' : 'condition';
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM assets WHERE ${column} = $1`,
    [code]
  );
  return rows[0].count;
}
