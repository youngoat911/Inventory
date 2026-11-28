/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

// Admin-managed master list of asset statuses and conditions.
// System rows are referenced by workflows (issues, maintenance, disposals)
// and cannot be deleted or have their code changed.
const SEED = [
  ['status', 'available', 'Available', 'ok', 1],
  ['status', 'reserved', 'Reserved', 'warn', 2],
  ['status', 'issued', 'Issued', 'info', 3],
  ['status', 'in_maintenance', 'In maintenance', 'warn', 4],
  ['status', 'disposed', 'Disposed', 'danger', 5],
  ['status', 'lost', 'Lost', 'danger', 6],
  ['condition', 'excellent', 'Excellent', 'ok', 1],
  ['condition', 'good', 'Good', 'ok', 2],
  ['condition', 'fair', 'Fair', 'warn', 3],
  ['condition', 'poor', 'Poor', 'danger', 4],
  ['condition', 'damaged', 'Damaged', 'danger', 5],
  ['condition', 'under_repair', 'Under repair', 'warn', 6],
];

export const up = (pgm) => {
  pgm.createTable('asset_status_master', {
    kind: { type: 'text', notNull: true },
    code: { type: 'text', notNull: true },
    label: { type: 'text', notNull: true },
    color: { type: 'text', notNull: true, default: 'neutral' },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    is_system: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('asset_status_master', 'asset_status_master_pkey', { primaryKey: ['kind', 'code'] });
  pgm.addConstraint('asset_status_master', 'asset_status_master_kind_chk', {
    check: "kind IN ('status', 'condition')",
  });
  pgm.addConstraint('asset_status_master', 'asset_status_master_code_chk', {
    check: "code ~ '^[a-z][a-z0-9_]{0,49}$'",
  });
  pgm.addConstraint('asset_status_master', 'asset_status_master_color_chk', {
    check: "color IN ('ok', 'info', 'warn', 'danger', 'neutral')",
  });

  for (const [kind, code, label, color, sort] of SEED) {
    pgm.sql(`
      INSERT INTO asset_status_master (kind, code, label, color, sort_order, is_system)
      VALUES ('${kind}', '${code}', '${label}', '${color}', ${sort}, true)
      ON CONFLICT DO NOTHING
    `);
  }

  // Preserve any non-standard values already present on assets
  pgm.sql(`
    INSERT INTO asset_status_master (kind, code, label, sort_order)
    SELECT DISTINCT 'status', status, initcap(replace(status, '_', ' ')), 100 FROM assets
    WHERE status ~ '^[a-z][a-z0-9_]{0,49}$'
    ON CONFLICT DO NOTHING;
    INSERT INTO asset_status_master (kind, code, label, sort_order)
    SELECT DISTINCT 'condition', condition, initcap(replace(condition, '_', ' ')), 100 FROM assets
    WHERE condition ~ '^[a-z][a-z0-9_]{0,49}$'
    ON CONFLICT DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.dropTable('asset_status_master');
};
