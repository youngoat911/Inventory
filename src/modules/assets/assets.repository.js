import { pool } from '../../db/pool.js';

export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO assets (
      asset_tag, name, description, category_id, tracking, quantity,
      low_stock_threshold, unit_cost, cost, capitalization_date, serial_no, brand_model, condition,
      status, owner_org_id, home_berm_id, location_id, responsible_user_id,
      is_issuable, loan_days_override, purchase_id, warranty_until, is_institute_asset
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING *`,
    [
      data.asset_tag || null,
      data.name,
      data.description || null,
      data.category_id,
      data.tracking,
      data.quantity,
      data.low_stock_threshold,
      data.unit_cost || null,
      data.cost ?? null,
      data.capitalization_date || null,
      data.serial_no || null,
      data.brand_model || null,
      data.condition,
      data.status,
      data.owner_org_id || null,
      data.home_berm_id || null,
      data.location_id || null,
      data.responsible_user_id || null,
      data.is_issuable,
      data.loan_days_override || null,
      data.purchase_id || null,
      data.warranty_until || null,
      data.is_institute_asset
    ]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT a.*,
            c.name as category_name,
            c.is_legacy as category_is_legacy,
            cp.full_path as category_path,
            cp.code_path as category_code_path,
            cp.top_level_name as top_level_category_name,
            SPLIT_PART(cp.code_path, '-', 1) as top_level_category_code,
            cp.effective_dep_rate_percent::float8 as effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 as top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            cp.top_level_dep_method,
            disp.disposed_on,
            org.name as owner_org_name,
            l.name as location_name,
            u.full_name as responsible_user_name
     FROM assets a
     LEFT JOIN categories c ON a.category_id = c.id
     LEFT JOIN category_paths cp ON a.category_id = cp.id
     LEFT JOIN LATERAL (
       SELECT d.disposed_on
       FROM disposals d
       WHERE d.asset_id = a.id AND d.status IN ('approved', 'completed')
       ORDER BY d.disposed_on DESC NULLS LAST, d.created_at DESC
       LIMIT 1
     ) disp ON true
     LEFT JOIN org_units org ON a.owner_org_id = org.id
     LEFT JOIN locations l ON a.location_id = l.id
     LEFT JOIN users u ON a.responsible_user_id = u.id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0];
}

export async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  // Search query
  if (filters.q) {
    paramCount++;
    conditions.push(`(
      a.name ILIKE $${paramCount} OR 
      a.description ILIKE $${paramCount} OR 
      a.asset_tag ILIKE $${paramCount} OR
      a.serial_no ILIKE $${paramCount}
    )`);
    values.push(`%${filters.q}%`);
  }

  // Status filter
  if (filters.status) {
    paramCount++;
    conditions.push(`a.status = $${paramCount}`);
    values.push(filters.status);
  }

  // Condition filter
  if (filters.condition) {
    paramCount++;
    conditions.push(`a.condition = $${paramCount}`);
    values.push(filters.condition);
  }

  // Tracking filter
  if (filters.tracking) {
    paramCount++;
    conditions.push(`a.tracking = $${paramCount}`);
    values.push(filters.tracking);
  }

  // Category filter (matches the category or any descendant)
  if (filters.category_id) {
    paramCount++;
    conditions.push(`($${paramCount} = ANY(cp.ancestor_ids) OR a.category_id = $${paramCount})`);
    values.push(filters.category_id);
  }

  // Owner org filter
  if (filters.owner_org_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.owner_org_id);
  }
  if (filters.owner_org_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.owner_org_ids);
  }

  // Location filter
  if (filters.location_id) {
    paramCount++;
    conditions.push(`a.location_id = $${paramCount}`);
    values.push(filters.location_id);
  }

  // Responsible user filter
  if (filters.responsible_user_id) {
    paramCount++;
    conditions.push(`a.responsible_user_id = $${paramCount}`);
    values.push(filters.responsible_user_id);
  }

  // Is issuable filter
  if (filters.is_issuable !== undefined) {
    paramCount++;
    conditions.push(`a.is_issuable = $${paramCount}`);
    values.push(filters.is_issuable);
  }

  // Is institute asset filter
  if (filters.is_institute_asset !== undefined) {
    paramCount++;
    conditions.push(`a.is_institute_asset = $${paramCount}`);
    values.push(filters.is_institute_asset);
  }

  // Low stock filter
  if (filters.low_stock === true) {
    conditions.push(`a.quantity <= a.low_stock_threshold`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sorting
  const sortColumn = parseSortColumn(filters.sort);

  const { rows } = await pool.query(
    `SELECT a.*,
            c.name as category_name,
            c.is_legacy as category_is_legacy,
            cp.full_path as category_path,
            cp.code_path as category_code_path,
            cp.top_level_name as top_level_category_name,
            SPLIT_PART(cp.code_path, '-', 1) as top_level_category_code,
            cp.effective_dep_rate_percent::float8 as effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 as top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            cp.top_level_dep_method,
            disp.disposed_on,
            org.name as owner_org_name,
            l.name as location_name,
            u.full_name as responsible_user_name,
            COUNT(*) OVER() as total_count
     FROM assets a
     LEFT JOIN categories c ON a.category_id = c.id
     LEFT JOIN category_paths cp ON a.category_id = cp.id
     LEFT JOIN LATERAL (
       SELECT d.disposed_on
       FROM disposals d
       WHERE d.asset_id = a.id AND d.status IN ('approved', 'completed')
       ORDER BY d.disposed_on DESC NULLS LAST, d.created_at DESC
       LIMIT 1
     ) disp ON true
     LEFT JOIN org_units org ON a.owner_org_id = org.id
     LEFT JOIN locations l ON a.location_id = l.id
     LEFT JOIN users u ON a.responsible_user_id = u.id
     ${whereClause}
     ORDER BY ${sortColumn}
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...values, filters.limit, filters.offset]
  );

  return {
    items: rows,
    total: rows.length > 0 ? parseInt(rows[0].total_count) : 0,
  };
}

export async function update(id, fields) {
  const allowed = [
    'asset_tag', 'name', 'description', 'category_id', 'tracking', 'quantity',
    'low_stock_threshold', 'unit_cost', 'cost', 'capitalization_date', 'serial_no', 'brand_model', 'condition',
    'status', 'owner_org_id', 'home_berm_id', 'location_id', 'responsible_user_id',
    'is_issuable', 'loan_days_override', 'purchase_id', 'warranty_until', 'is_institute_asset'
  ];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  
  if (entries.length === 0) {
    return getById(id);
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE assets 
     SET ${assignments.join(', ')}, updated_at = now() 
     WHERE id = $${values.length} 
     RETURNING *`,
    values
  );

  return rows[0];
}

export async function deleteById(id) {
  const { rows } = await pool.query(
    'DELETE FROM assets WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

export async function getByAssetTag(assetTag) {
  const { rows } = await pool.query(
    'SELECT * FROM assets WHERE asset_tag = $1',
    [assetTag]
  );
  return rows[0];
}

export async function getBySerialNo(serialNo) {
  const { rows } = await pool.query(
    'SELECT * FROM assets WHERE serial_no = $1',
    [serialNo]
  );
  return rows[0];
}

export async function hasActiveIssues(assetId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count 
     FROM issues 
     WHERE asset_id = $1 AND status IN ('requested', 'active', 'dropped')`,
    [assetId]
  );
  return parseInt(rows[0].count) > 0;
}

export async function hasActiveTransfers(assetId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count 
     FROM transfers 
     WHERE asset_id = $1 AND status IN ('requested', 'approved')`,
    [assetId]
  );
  return parseInt(rows[0].count) > 0;
}

export async function exportAssets(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  // Apply same filters as list
  if (filters.q) {
    paramCount++;
    conditions.push(`(
      a.name ILIKE $${paramCount} OR 
      a.description ILIKE $${paramCount} OR 
      a.asset_tag ILIKE $${paramCount} OR
      a.serial_no ILIKE $${paramCount}
    )`);
    values.push(`%${filters.q}%`);
  }

  if (filters.status) {
    paramCount++;
    conditions.push(`a.status = $${paramCount}`);
    values.push(filters.status);
  }

  if (filters.condition) {
    paramCount++;
    conditions.push(`a.condition = $${paramCount}`);
    values.push(filters.condition);
  }

  if (filters.tracking) {
    paramCount++;
    conditions.push(`a.tracking = $${paramCount}`);
    values.push(filters.tracking);
  }

  if (filters.category_id) {
    paramCount++;
    conditions.push(`($${paramCount} = ANY(cp.ancestor_ids) OR a.category_id = $${paramCount})`);
    values.push(filters.category_id);
  }

  if (filters.owner_org_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.owner_org_id);
  }
  if (filters.owner_org_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.owner_org_ids);
  }

  if (filters.location_id) {
    paramCount++;
    conditions.push(`a.location_id = $${paramCount}`);
    values.push(filters.location_id);
  }

  if (filters.responsible_user_id) {
    paramCount++;
    conditions.push(`a.responsible_user_id = $${paramCount}`);
    values.push(filters.responsible_user_id);
  }

  if (filters.is_issuable !== undefined) {
    paramCount++;
    conditions.push(`a.is_issuable = $${paramCount}`);
    values.push(filters.is_issuable);
  }

  if (filters.is_institute_asset !== undefined) {
    paramCount++;
    conditions.push(`a.is_institute_asset = $${paramCount}`);
    values.push(filters.is_institute_asset);
  }

  if (filters.low_stock === true) {
    conditions.push(`a.quantity <= a.low_stock_threshold`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.*,
            c.name as category_name,
            c.is_legacy as category_is_legacy,
            cp.full_path as category_path,
            cp.code_path as category_code_path,
            cp.top_level_name as top_level_category_name,
            org.name as owner_org_name,
            l.name as location_name,
            u.full_name as responsible_user_name
     FROM assets a
     LEFT JOIN categories c ON a.category_id = c.id
     LEFT JOIN category_paths cp ON a.category_id = cp.id
     LEFT JOIN org_units org ON a.owner_org_id = org.id
     LEFT JOIN locations l ON a.location_id = l.id
     LEFT JOIN users u ON a.responsible_user_id = u.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT 5000`,
    values
  );

  return rows;
}

export async function getCategoryForAsset(categoryId, client = pool) {
  const { rows } = await client.query(
    `SELECT cp.id, cp.level, cp.is_legacy, cp.is_leaf
     FROM category_paths cp
     WHERE cp.id = $1`,
    [categoryId]
  );
  return rows[0];
}

function parseSortColumn(sort) {
  const ALLOWED_SORT_COLUMNS = {
    'name': 'a.name',
    'asset_tag': 'a.asset_tag',
    'status': 'a.status',
    'condition': 'a.condition',
    'quantity': 'a.quantity',
    'created_at': 'a.created_at',
    'updated_at': 'a.updated_at',
  };

  if (!sort) return 'a.created_at DESC';

  const parts = sort.split(',').map(s => s.trim());
  const expressions = [];

  for (const part of parts) {
    const descending = part.startsWith('-');
    const key = descending ? part.slice(1) : part;
    const column = ALLOWED_SORT_COLUMNS[key];
    
    if (column) {
      expressions.push(`${column} ${descending ? 'DESC' : 'ASC'}`);
    }
  }

  return expressions.length > 0 ? expressions.join(', ') : 'a.created_at DESC';
}
