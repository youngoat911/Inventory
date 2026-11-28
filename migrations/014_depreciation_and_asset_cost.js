/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

const LEVEL_1_RATES = [
  ['01', 0, null],
  ['02', 0, null],
  ['03', 2, null],
  ['04', 2, null],
  ['05', 2, null],
  ['06', 2, null],
  ['07', 5, null],
  ['08', 5, null],
  ['09', 8, null],
  ['10', 7.5, null],
  ['11', 7.5, null],
  ['12', 20, null],
  ['13', 7.5, null],
  ['14', 10, null],
  ['15', 10, null],
  ['16', 100, null],
  ['17', 40, null],
  ['18', 40, null],
  ['19', null, 9],
];

export const up = (pgm) => {
  pgm.addColumns('categories', {
    dep_rate_percent: { type: 'numeric(6,3)' },
    amortization_life_years: { type: 'integer' },
    dep_method: { type: 'text', notNull: true, default: 'SLM' },
  });

  pgm.addConstraint('categories', 'categories_rate_only_level1_chk', {
    check: 'level = 1 OR (dep_rate_percent IS NULL AND amortization_life_years IS NULL)',
  });

  pgm.addConstraint('categories', 'categories_dep_rate_nonneg_chk', {
    check: 'dep_rate_percent IS NULL OR (dep_rate_percent >= 0 AND dep_rate_percent <= 100)',
  });

  pgm.addConstraint('categories', 'categories_amort_life_pos_chk', {
    check: 'amortization_life_years IS NULL OR amortization_life_years > 0',
  });

  for (const [code, rate, life] of LEVEL_1_RATES) {
    const rateSql = rate === null ? 'NULL' : String(rate);
    const lifeSql = life === null ? 'NULL' : String(life);
    pgm.sql(`
      UPDATE categories
      SET dep_rate_percent = ${rateSql},
          amortization_life_years = ${lifeSql},
          dep_method = 'SLM'
      WHERE level = 1 AND code = '${code}' AND is_system = true
    `);
  }

  // Extend category_paths view with inherited depreciation rate columns
  pgm.sql(`
    CREATE OR REPLACE VIEW category_paths AS
    WITH RECURSIVE tree AS (
      SELECT
        c.id,
        c.parent_id,
        c.name,
        c.level,
        c.code,
        c.is_system,
        c.is_legacy,
        c.sort_order,
        c.name AS full_path,
        COALESCE(c.code, '') AS code_path,
        c.id AS top_level_id,
        c.name AS top_level_name,
        ARRAY[c.id] AS ancestor_ids,
        c.dep_rate_percent AS top_level_dep_rate_percent,
        c.amortization_life_years AS top_level_amortization_life_years,
        c.dep_method AS top_level_dep_method
      FROM categories c
      WHERE c.parent_id IS NULL

      UNION ALL

      SELECT
        child.id,
        child.parent_id,
        child.name,
        child.level,
        child.code,
        child.is_system,
        child.is_legacy,
        child.sort_order,
        t.full_path || ' > ' || child.name AS full_path,
        CASE
          WHEN t.code_path <> '' AND child.code IS NOT NULL THEN t.code_path || '-' || child.code
          ELSE COALESCE(child.code, t.code_path)
        END AS code_path,
        t.top_level_id,
        t.top_level_name,
        t.ancestor_ids || child.id AS ancestor_ids,
        t.top_level_dep_rate_percent,
        t.top_level_amortization_life_years,
        t.top_level_dep_method
      FROM categories child
      JOIN tree t ON child.parent_id = t.id
    )
    SELECT
      t.id,
      t.parent_id,
      t.name,
      t.level,
      t.code,
      t.is_system,
      t.is_legacy,
      t.sort_order,
      t.full_path,
      t.code_path,
      t.top_level_id,
      t.top_level_name,
      t.ancestor_ids,
      NOT EXISTS (
        SELECT 1 FROM categories ch WHERE ch.parent_id = t.id
      ) AS is_leaf,
      t.top_level_dep_rate_percent,
      t.top_level_amortization_life_years,
      t.top_level_dep_method,
      CASE
        WHEN t.top_level_dep_rate_percent IS NOT NULL THEN t.top_level_dep_rate_percent
        WHEN t.top_level_amortization_life_years IS NOT NULL AND t.top_level_amortization_life_years > 0
          THEN ROUND((100.0 / t.top_level_amortization_life_years)::numeric, 3)
        ELSE NULL
      END AS effective_dep_rate_percent
    FROM tree t;
  `);

  pgm.addColumns('assets', {
    cost: { type: 'numeric(14,2)', check: 'cost >= 0' },
    capitalization_date: { type: 'date' },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('assets', ['cost', 'capitalization_date']);

  pgm.sql('DROP VIEW IF EXISTS category_paths');
  pgm.sql(`
    CREATE OR REPLACE VIEW category_paths AS
    WITH RECURSIVE tree AS (
      SELECT
        c.id,
        c.parent_id,
        c.name,
        c.level,
        c.code,
        c.is_system,
        c.is_legacy,
        c.sort_order,
        c.name AS full_path,
        COALESCE(c.code, '') AS code_path,
        c.id AS top_level_id,
        c.name AS top_level_name,
        ARRAY[c.id] AS ancestor_ids
      FROM categories c
      WHERE c.parent_id IS NULL

      UNION ALL

      SELECT
        child.id,
        child.parent_id,
        child.name,
        child.level,
        child.code,
        child.is_system,
        child.is_legacy,
        child.sort_order,
        t.full_path || ' > ' || child.name AS full_path,
        CASE
          WHEN t.code_path <> '' AND child.code IS NOT NULL THEN t.code_path || '-' || child.code
          ELSE COALESCE(child.code, t.code_path)
        END AS code_path,
        t.top_level_id,
        t.top_level_name,
        t.ancestor_ids || child.id AS ancestor_ids
      FROM categories child
      JOIN tree t ON child.parent_id = t.id
    )
    SELECT
      t.*,
      NOT EXISTS (
        SELECT 1 FROM categories ch WHERE ch.parent_id = t.id
      ) AS is_leaf
    FROM tree t;
  `);

  pgm.dropConstraint('categories', 'categories_amort_life_pos_chk', { ifExists: true });
  pgm.dropConstraint('categories', 'categories_dep_rate_nonneg_chk', { ifExists: true });
  pgm.dropConstraint('categories', 'categories_rate_only_level1_chk', { ifExists: true });
  pgm.dropColumns('categories', ['dep_rate_percent', 'amortization_life_years', 'dep_method']);
};
