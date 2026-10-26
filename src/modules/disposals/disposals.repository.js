import { pool } from '../../db/pool.js';

const selectDisposal = `
  SELECT d.*, a.name AS asset_name, a.asset_tag,
         proposer.full_name AS proposed_by_name,
         approver.full_name AS approved_by_name,
         rejecter.full_name AS rejected_by_name
  FROM disposals d
  JOIN assets a ON a.id = d.asset_id
  LEFT JOIN users proposer ON proposer.id = d.proposed_by
  LEFT JOIN users approver ON approver.id = d.approved_by
  LEFT JOIN users rejecter ON rejecter.id = d.rejected_by
`;

export async function listDisposals({ status, limit, offset, orgUnitIds }) {
  const conditions = [];
  const values = [];
  if (status) {
    values.push(status);
    conditions.push(`d.status = $${values.length}`);
  }
  if (orgUnitIds) {
    values.push(orgUnitIds);
    conditions.push(`a.owner_org_id = ANY($${values.length}::uuid[])`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*) FROM disposals d JOIN assets a ON a.id = d.asset_id ${where}`, values);
  const total = Number(count.rows[0].count);
  values.push(limit, offset);
  const result = await pool.query(
    `${selectDisposal} ${where} ORDER BY d.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total };
}

export async function findDisposal(id, client = pool) {
  const result = await client.query(`${selectDisposal} WHERE d.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function createDisposal(data, client = pool) {
  const result = await client.query(
    `INSERT INTO disposals (asset_id, quantity, reason, details, proposed_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.asset_id, data.quantity, data.reason, data.details || null, data.proposed_by]
  );
  return findDisposal(result.rows[0].id, client);
}

export async function updateDisposal(id, data, client = pool) {
  const entries = Object.entries(data);
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);
  const result = await client.query(
    `UPDATE disposals SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING id`,
    values
  );
  return result.rows[0] ? findDisposal(result.rows[0].id, client) : null;
}