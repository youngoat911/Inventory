import { pool } from '../../db/pool.js';
import { getAdminOrgIds } from '../../middleware/authorize.js';

export async function listCycles(req, res, next) {
  try {
    const { page, limit } = req.validated.query;
    const orgIds = getAdminOrgIds(req.user);
    const values = orgIds === null ? [limit, (page - 1) * limit] : [orgIds, limit, (page - 1) * limit];
    const scope = orgIds === null ? '' : 'WHERE vc.org_unit_id = ANY($1::uuid[])';
    const limitParam = orgIds === null ? 1 : 2;
    const offsetParam = orgIds === null ? 2 : 3;
    const count = await pool.query(`SELECT COUNT(*) FROM verification_cycles vc ${scope}`, values.slice(0, orgIds === null ? 0 : 1));
    const result = await pool.query(`SELECT vc.*, COUNT(v.id)::int AS total_assets, COUNT(v.id) FILTER (WHERE v.status = 'verified')::int AS verified_count FROM verification_cycles vc LEFT JOIN verifications v ON v.cycle_id = vc.id ${scope} GROUP BY vc.id ORDER BY vc.created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`, values);
    res.json({ data: result.rows, meta: { page, limit, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / limit) } });
  } catch (error) { next(error); }
}

export async function createCycle(req, res, next) {
  try {
    const { name, description, org_unit_id, starts_on, ends_on } = req.validated.body;
    const result = await pool.query(`INSERT INTO verification_cycles (name, org_unit_id, starts_on, ends_on, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [name, org_unit_id, starts_on, ends_on, req.user.id]);
    res.status(201).json({ data: { ...result.rows[0], description } });
  } catch (error) { next(error); }
}