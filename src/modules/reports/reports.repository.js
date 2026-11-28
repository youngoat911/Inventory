import { pool } from '../../db/pool.js';

// Dashboard queries
export async function getDashboardSummary(borrowerId = null, orgIds = null) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM assets WHERE ($2::uuid[] IS NULL OR owner_org_id = ANY($2))) as total_assets,
      (SELECT COUNT(*) FROM issues i JOIN assets a ON a.id = i.asset_id
       WHERE i.status IN ('active', 'dropped') AND ($1::uuid IS NULL OR i.borrower_id = $1)
         AND ($2::uuid[] IS NULL OR a.owner_org_id = ANY($2))) as active_issues,
      (SELECT COUNT(*) FROM issues i JOIN assets a ON a.id = i.asset_id
       WHERE i.status IN ('active', 'dropped') AND i.due_at < NOW()
         AND ($1::uuid IS NULL OR i.borrower_id = $1)
         AND ($2::uuid[] IS NULL OR a.owner_org_id = ANY($2))) as overdue_count,
      (SELECT COUNT(*) FROM assets WHERE quantity <= low_stock_threshold
       AND ($2::uuid[] IS NULL OR owner_org_id = ANY($2))) as low_stock_count,
      (SELECT COUNT(*) FROM assets WHERE status = 'in_maintenance'
       AND ($2::uuid[] IS NULL OR owner_org_id = ANY($2))) as open_maintenance,
      0 as pending_verifications,
      0 as pending_disposals,
      0 as active_alerts
  `, [borrowerId, orgIds]);
  
  return rows[0];
}

export async function getOrgDashboard(orgId) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM assets WHERE owner_org_id = $1) as total_assets,
      (SELECT COUNT(*) FROM issues i 
       JOIN assets a ON i.asset_id = a.id 
       WHERE a.owner_org_id = $1 AND i.status IN ('active', 'dropped')) as active_issues,
      (SELECT COUNT(*) FROM issues i 
       JOIN assets a ON i.asset_id = a.id 
       WHERE a.owner_org_id = $1 AND i.status IN ('active', 'dropped') AND i.due_at < NOW()) as overdue_count,
      (SELECT COUNT(*) FROM assets WHERE owner_org_id = $1 AND quantity <= low_stock_threshold) as low_stock_count,
      (SELECT COUNT(*) FROM assets WHERE owner_org_id = $1 AND status = 'in_maintenance') as open_maintenance,
      0 as pending_verifications,
      0 as pending_disposals,
      0 as active_alerts
  `, [orgId]);
  
  return rows[0];
}

// Report queries
export async function getAssetInventory(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.org_unit_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.org_unit_id);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  if (filters.category_id) {
    paramCount++;
    conditions.push(`a.category_id = $${paramCount}`);
    values.push(filters.category_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT 
      a.*,
      c.name as category_name,
      org.name as owner_org_name,
      l.name as location_name
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN org_units org ON a.owner_org_id = org.id
    LEFT JOIN locations l ON a.location_id = l.id
    ${whereClause}
    ORDER BY a.name
    LIMIT 5000
  `, values);

  return rows;
}

export async function getBorrowingHistory(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.user_id) {
    paramCount++;
    conditions.push(`i.borrower_id = $${paramCount}`);
    values.push(filters.user_id);
  }

  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  if (filters.date_from) {
    paramCount++;
    conditions.push(`i.requested_at >= $${paramCount}::date`);
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    conditions.push(`i.requested_at < ($${paramCount}::date + interval '1 day')`);
    values.push(filters.date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT 
      i.*,
      a.name as asset_name,
      a.asset_tag,
      u.full_name as borrower_name,
      issuer.full_name as issued_by_name,
      receiver.full_name as received_by_name
    FROM issues i
    JOIN assets a ON i.asset_id = a.id
    JOIN users u ON i.borrower_id = u.id
    LEFT JOIN users issuer ON i.issued_by = issuer.id
    LEFT JOIN users receiver ON i.received_by = receiver.id
    ${whereClause}
    ORDER BY i.requested_at DESC
    LIMIT 1000
  `, values);

  return rows;
}

export async function getOverdueLoans(filters) {
  const conditions = ['i.status IN (\'active\', \'dropped\')', 'i.due_at < NOW()'];
  const values = [];
  let paramCount = 0;

  if (filters.org_unit_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.org_unit_id);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  const { rows } = await pool.query(`
    SELECT 
      i.*,
      a.name as asset_name,
      a.asset_tag,
      u.full_name as borrower_name,
      u.institute_email as borrower_email,
      NOW() - i.due_at as overdue_duration
    FROM issues i
    JOIN assets a ON i.asset_id = a.id
    JOIN users u ON i.borrower_id = u.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.due_at ASC
  `, values);

  return rows;
}

export async function getMaintenanceCosts(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.date_from) {
    paramCount++;
    conditions.push(`m.created_at >= $${paramCount}::date`);
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    conditions.push(`m.created_at < ($${paramCount}::date + interval '1 day')`);
    values.push(filters.date_to);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT 
      COUNT(*) as total_maintenance_records,
      COALESCE(SUM(CASE WHEN m.cost IS NOT NULL THEN 1 ELSE 0 END), 0) as records_with_cost,
      COALESCE(SUM(m.cost), 0) as total_cost,
      COALESCE(AVG(m.cost), 0) as average_cost,
      COALESCE(MIN(m.cost), 0) as min_cost,
      COALESCE(MAX(m.cost), 0) as max_cost
    FROM maintenance_records m
    JOIN assets a ON a.id = m.asset_id
    ${whereClause}
  `, values);

  return rows[0];
}

export async function getDisposalSummary(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.date_from) {
    paramCount++;
    conditions.push(`d.created_at >= $${paramCount}::date`);
    values.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    conditions.push(`d.created_at < ($${paramCount}::date + interval '1 day')`);
    values.push(filters.date_to);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT 
      COUNT(*) as total_disposals,
      SUM(CASE WHEN d.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN d.status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN d.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN d.status = 'completed' THEN 1 ELSE 0 END) as completed,
      COALESCE(SUM(d.salvage_value), 0) as total_salvage_value
    FROM disposals d
    JOIN assets a ON a.id = d.asset_id
    ${whereClause}
  `, values);

  return rows[0];
}

export async function getVerificationProgress(filters) {
  const { rows } = await pool.query(`
    SELECT
      vc.id as cycle_id,
      vc.name as cycle_name,
      vc.status as cycle_status,
      vc.starts_on,
      vc.ends_on,
      COUNT(DISTINCT a.id) as total_assets,
      COUNT(DISTINCT v.id) as verified_assets,
      COUNT(DISTINCT a.id) - COUNT(DISTINCT v.id) as pending_assets,
      CASE 
        WHEN COUNT(DISTINCT a.id) > 0 
        THEN ROUND((COUNT(DISTINCT v.id)::numeric / COUNT(DISTINCT a.id)::numeric) * 100, 2)
        ELSE 0
      END as completion_percentage
    FROM verification_cycles vc
    LEFT JOIN assets a ON a.owner_org_id = vc.org_unit_id
    LEFT JOIN verifications v ON v.cycle_id = vc.id AND v.asset_id = a.id
    WHERE vc.id = $1
      AND ($2::uuid[] IS NULL OR vc.org_unit_id = ANY($2))
    GROUP BY vc.id, vc.name, vc.status, vc.starts_on, vc.ends_on
  `, [filters.cycle_id, filters.org_unit_ids || null]);

  return rows[0] || null;
}

export async function getAssetUtilization(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 0;

  if (filters.org_unit_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.org_unit_id);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT 
      a.id,
      a.name,
      a.asset_tag,
      COUNT(i.id) as total_issues,
      COUNT(CASE WHEN i.status IN ('active', 'dropped') THEN 1 END) as active_issues,
      COUNT(CASE WHEN i.status = 'returned' THEN 1 END) as completed_issues,
      COALESCE(AVG(EXTRACT(EPOCH FROM (i.returned_at - i.issued_at)) / 86400), 0)::numeric(10,2) as avg_loan_duration_days
    FROM assets a
    LEFT JOIN issues i ON i.asset_id = a.id AND i.issued_at IS NOT NULL
    ${whereClause}
    GROUP BY a.id, a.name, a.asset_tag
    HAVING COUNT(i.id) > 0
    ORDER BY total_issues DESC
    LIMIT 100
  `, values);

  return rows;
}


export async function getDepreciationData(filters = {}) {
  const { rows: level1Categories } = await pool.query(
    `SELECT id, code, name, dep_rate_percent::float8 AS dep_rate_percent,
            amortization_life_years, dep_method, sort_order
     FROM categories
     WHERE level = 1 AND is_system = true
     ORDER BY sort_order ASC, code ASC`
  );

  const conditions = ['a.cost IS NOT NULL', 'a.capitalization_date IS NOT NULL', 'cp.top_level_id IS NOT NULL'];
  const values = [];
  let paramCount = 0;

  if (filters.org_unit_id) {
    paramCount++;
    conditions.push(`a.owner_org_id = $${paramCount}`);
    values.push(filters.org_unit_id);
  }
  if (filters.org_unit_ids) {
    paramCount++;
    conditions.push(`a.owner_org_id = ANY($${paramCount}::uuid[])`);
    values.push(filters.org_unit_ids);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const { rows: assets } = await pool.query(
    `SELECT a.id,
            a.name,
            a.cost::float8 AS cost,
            a.capitalization_date,
            a.status,
            a.owner_org_id,
            cp.top_level_id,
            cp.top_level_name,
            SPLIT_PART(cp.code_path, '-', 1) AS top_level_category_code,
            cp.effective_dep_rate_percent::float8 AS effective_dep_rate_percent,
            cp.top_level_dep_rate_percent::float8 AS top_level_dep_rate_percent,
            cp.top_level_amortization_life_years,
            disp.disposed_on
     FROM assets a
     JOIN category_paths cp ON cp.id = a.category_id
     LEFT JOIN LATERAL (
       SELECT d.disposed_on
       FROM disposals d
       WHERE d.asset_id = a.id AND d.status IN ('approved', 'completed')
       ORDER BY d.disposed_on DESC NULLS LAST, d.created_at DESC
       LIMIT 1
     ) disp ON true
     ${whereClause}`,
    values
  );

  return { level1Categories, assets };
}
