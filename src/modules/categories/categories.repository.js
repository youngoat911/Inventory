import { pool } from '../../db/pool.js';

export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO categories (
       name, parent_id, level, code, is_system, is_legacy, sort_order,
       default_low_stock_threshold, default_loan_days, max_renewals
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.parent_id || null,
      data.level,
      data.code,
      data.is_system ?? false,
      data.is_legacy ?? false,
      data.sort_order ?? 0,
      data.default_low_stock_threshold ?? 0,
      data.default_loan_days ?? 7,
      data.max_renewals ?? 0,
    ]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT c.*,
            parent.name AS parent_name,
            cp.full_path,
            cp.code_path,
            cp.top_level_id,
            cp.top_level_name,
            cp.is_leaf,
            cp.effective_dep_rate_percent::float8 AS effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 AS top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            cp.top_level_dep_method
     FROM categories c
     LEFT JOIN categories parent ON c.parent_id = parent.id
     LEFT JOIN category_paths cp ON cp.id = c.id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0];
}

export async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.parent_id !== undefined) {
    if (filters.parent_id === null || filters.parent_id === 'null') {
      conditions.push(`c.parent_id IS NULL`);
    } else {
      paramCount++;
      conditions.push(`c.parent_id = $${paramCount}`);
      values.push(filters.parent_id);
    }
  }

  if (filters.level !== undefined) {
    paramCount++;
    conditions.push(`c.level = $${paramCount}`);
    values.push(filters.level);
  }

  if (filters.is_legacy !== undefined) {
    paramCount++;
    conditions.push(`c.is_legacy = $${paramCount}`);
    values.push(filters.is_legacy);
  }

  if (filters.search) {
    paramCount++;
    conditions.push(`(c.name ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`);
    values.push(`%${filters.search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT c.*,
            parent.name AS parent_name,
            cp.full_path,
            cp.code_path,
            cp.is_leaf,
            cp.effective_dep_rate_percent::float8 AS effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 AS top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            cp.top_level_dep_method,
            COUNT(*) OVER() AS total_count
     FROM categories c
     LEFT JOIN categories parent ON c.parent_id = parent.id
     LEFT JOIN category_paths cp ON cp.id = c.id
     ${whereClause}
     ORDER BY c.is_legacy ASC, c.sort_order ASC, c.code ASC NULLS LAST, c.name ASC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...values, filters.limit, filters.offset]
  );

  return {
    items: rows,
    total: rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0,
  };
}

export async function getAllWithAssetCounts() {
  const { rows } = await pool.query(
    `SELECT c.*,
            cp.full_path,
            cp.code_path,
            cp.top_level_id,
            cp.top_level_name,
            cp.is_leaf,
            cp.effective_dep_rate_percent::float8 AS effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 AS top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            cp.top_level_dep_method,
            COALESCE(ac.direct_count, 0)::int AS direct_asset_count
     FROM categories c
     LEFT JOIN category_paths cp ON cp.id = c.id
     LEFT JOIN (
       SELECT category_id, COUNT(*)::int AS direct_count
       FROM assets
       GROUP BY category_id
     ) ac ON ac.category_id = c.id
     ORDER BY c.is_legacy ASC, COALESCE(c.level, 99) ASC, c.sort_order ASC, c.code ASC NULLS LAST, c.name ASC`
  );
  return rows;
}

export async function getPath(id) {
  const { rows } = await pool.query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, name, code, level, is_system, is_legacy, 0 AS depth
       FROM categories
       WHERE id = $1
       UNION ALL
       SELECT p.id, p.parent_id, p.name, p.code, p.level, p.is_system, p.is_legacy, a.depth + 1
       FROM categories p
       JOIN ancestors a ON p.id = a.parent_id
     )
     SELECT id, parent_id, name, code, level, is_system, is_legacy
     FROM ancestors
     ORDER BY depth DESC`,
    [id]
  );
  return rows;
}

export async function update(id, fields) {
  const allowed = [
    'name',
    'parent_id',
    'level',
    'code',
    'sort_order',
    'default_low_stock_threshold',
    'default_loan_days',
    'max_renewals',
  ];
  const entries = Object.entries(fields).filter(([key, value]) => allowed.includes(key) && value !== undefined);

  if (entries.length === 0) {
    return getById(id);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE categories
     SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  return rows[0];
}

export async function deleteById(id) {
  const { rows } = await pool.query(
    'DELETE FROM categories WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

export async function getChildren(parentId) {
  const { rows } = await pool.query(
    `SELECT c.*,
            cp.full_path,
            cp.code_path,
            cp.is_leaf
     FROM categories c
     LEFT JOIN category_paths cp ON cp.id = c.id
     WHERE c.parent_id = $1
     ORDER BY c.sort_order ASC, c.code ASC NULLS LAST, c.name ASC`,
    [parentId]
  );
  return rows;
}

export async function getSiblingByName(parentId, name, excludeId = null) {
  const params = [parentId || null, name];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = 'AND id <> $3';
  }
  const { rows } = await pool.query(
    `SELECT * FROM categories
     WHERE parent_id IS NOT DISTINCT FROM $1
       AND LOWER(name) = LOWER($2)
       AND is_legacy = false
       ${excludeClause}`,
    params
  );
  return rows[0];
}

export async function getSiblingByCode(parentId, code, excludeId = null) {
  const params = [parentId || null, code];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = 'AND id <> $3';
  }
  const { rows } = await pool.query(
    `SELECT * FROM categories
     WHERE parent_id IS NOT DISTINCT FROM $1
       AND code = $2
       AND is_legacy = false
       ${excludeClause}`,
    params
  );
  return rows[0];
}

export async function getNextSiblingCode(parentId) {
  const { rows } = await pool.query(
    `SELECT code FROM categories
     WHERE parent_id IS NOT DISTINCT FROM $1
       AND is_legacy = false
       AND code ~ '^[0-9]+$'`,
    [parentId || null]
  );
  const used = new Set(rows.map((r) => parseInt(r.code, 10)));
  let next = 1;
  while (used.has(next)) next++;
  return String(next).padStart(2, '0');
}

export async function getDependencyCounts(categoryId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM categories WHERE parent_id = $1) AS children_count,
       (SELECT COUNT(*)::int FROM assets WHERE category_id = $1) AS assets_count`,
    [categoryId]
  );
  return rows[0];
}

export async function hasAssets(categoryId) {
  const { assets_count } = await getDependencyCounts(categoryId);
  return assets_count > 0;
}
