import { pool } from '../../db/pool.js';

export async function list(req, res, next) {
  try {
    const { limit, is_read: readFilter } = req.validated.query;
    const values = [req.user.id];
    const conditions = ['user_id = $1'];
    if (readFilter) {
      conditions.push(readFilter === 'true' ? 'read_at IS NOT NULL' : 'read_at IS NULL');
    }
    values.push(limit);
    const result = await pool.query(`SELECT *, (read_at IS NOT NULL) AS is_read FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${values.length}`, values);
    res.json({ data: result.rows });
  } catch (error) { next(error); }
}

export async function markRead(req, res, next) {
  try {
    const result = await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id', [req.validated.params.id, req.user.id]);
    res.json({ data: result.rows[0] || null });
  } catch (error) { next(error); }
}

export async function markAllRead(req, res, next) {
  try {
    await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
    res.status(204).send();
  } catch (error) { next(error); }
}