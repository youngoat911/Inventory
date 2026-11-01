import { pool } from '../../db/pool.js';

const selectRecord = `
  SELECT m.*, a.name AS asset_name, a.asset_tag
  FROM maintenance_records m JOIN assets a ON a.id = m.asset_id
`;

export async function listMaintenance({ limit, offset, orgUnitIds }) {
  const values = orgUnitIds ? [orgUnitIds, limit, offset] : [limit, offset];
  const scope = orgUnitIds ? 'WHERE a.owner_org_id = ANY($1::uuid[])' : '';
  const limitParam = orgUnitIds ? 2 : 1;
  const offsetParam = orgUnitIds ? 3 : 2;
  const count = await pool.query(`SELECT COUNT(*) FROM maintenance_records m JOIN assets a ON a.id = m.asset_id ${scope}`, values.slice(0, orgUnitIds ? 1 : 0));
  const result = await pool.query(`${selectRecord} ${scope} ORDER BY m.created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`, values);
  return { rows: result.rows, total: Number(count.rows[0].count) };
}

export async function findMaintenance(id, client = pool) {
  const result = await client.query(`${selectRecord} WHERE m.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function createMaintenance(data, client = pool) {
  const result = await client.query(
    `INSERT INTO maintenance_records (asset_id, type, description, reported_by, cost, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.asset_id, data.type, data.description, data.reported_by, data.cost ?? null, data.notes || null]
  );
  return findMaintenance(result.rows[0].id, client);
}

export async function resolveMaintenance(id, userId, client = pool) {
  const result = await client.query(
    `UPDATE maintenance_records SET status = 'resolved', resolved_by = $1,
     resolved_at = NOW(), updated_at = NOW() WHERE id = $2 AND status <> 'resolved' RETURNING id`,
    [userId, id]
  );
  return result.rows[0] ? findMaintenance(id, client) : null;
}