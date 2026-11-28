/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

// Per-prefix counters used to auto-generate each item's unique number
// (asset_tag), formatted as <category code path>-<NNNN>, e.g. 12-01-03-0007.
export const up = (pgm) => {
  pgm.createTable('asset_tag_sequences', {
    prefix: { type: 'text', primaryKey: true },
    last_value: { type: 'integer', notNull: true, default: 0 },
  });

  // Backfill a unique number for existing assets that have none
  pgm.sql(`
    WITH untagged AS (
      SELECT a.id,
             COALESCE(NULLIF(cp.code_path, ''), 'AST') AS prefix,
             a.created_at
      FROM assets a
      LEFT JOIN category_paths cp ON cp.id = a.category_id
      WHERE a.asset_tag IS NULL OR a.asset_tag = ''
    ),
    numbered AS (
      SELECT id, prefix,
             ROW_NUMBER() OVER (PARTITION BY prefix ORDER BY created_at, id) AS n
      FROM untagged
    )
    UPDATE assets a
    SET asset_tag = numbered.prefix || '-' || LPAD(numbered.n::text, 4, '0')
    FROM numbered
    WHERE a.id = numbered.id
      AND NOT EXISTS (
        SELECT 1 FROM assets x WHERE x.asset_tag = numbered.prefix || '-' || LPAD(numbered.n::text, 4, '0')
      );

    INSERT INTO asset_tag_sequences (prefix, last_value)
    SELECT prefix, MAX(n)::int FROM (
      SELECT COALESCE(NULLIF(cp.code_path, ''), 'AST') AS prefix,
             ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(cp.code_path, ''), 'AST') ORDER BY a.created_at, a.id) AS n
      FROM assets a
      LEFT JOIN category_paths cp ON cp.id = a.category_id
    ) s
    GROUP BY prefix
    ON CONFLICT (prefix) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.dropTable('asset_tag_sequences');
};
