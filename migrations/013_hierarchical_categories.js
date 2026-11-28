/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

const LEVEL_1_CATEGORIES = [
  ['01', 'Land'],
  ['02', 'Site Development'],
  ['03', 'Buildings'],
  ['04', 'Roads and Bridges'],
  ['05', 'Tubewell & Water Supply'],
  ['06', 'Sewage and Drainage'],
  ['07', 'Electrical Installation and Equipment'],
  ['08', 'Plant and Machinery'],
  ['09', 'Scientific and Laboratory Equipment'],
  ['10', 'Office Equipment'],
  ['11', 'Audio Visual Equipment'],
  ['12', 'Computers and Peripherals'],
  ['13', 'Furniture, Fixtures and Fittings'],
  ['14', 'Vehicles'],
  ['15', 'Library Books'],
  ['16', 'Small Value Assets'],
  ['17', 'Computer Software'],
  ['18', 'E-Journals'],
  ['19', 'Patents'],
];

export const up = (pgm) => {
  pgm.addColumns('categories', {
    level: { type: 'smallint' },
    code: { type: 'text' },
    is_system: { type: 'boolean', notNull: true, default: false },
    is_legacy: { type: 'boolean', notNull: true, default: false },
    sort_order: { type: 'integer', notNull: true, default: 0 },
  });

  pgm.alterColumn('categories', 'default_loan_days', { default: 7 });

  // Preserve any pre-existing categories as legacy so existing assets stay valid
  pgm.sql(`
    UPDATE categories
    SET is_legacy = true,
        is_system = false,
        code = COALESCE(code, 'LEG-' || substr(id::text, 1, 8))
    WHERE level IS NULL
  `);

  // Check constraints for level & parent_id invariants
  pgm.addConstraint('categories', 'categories_level_range_chk', {
    check: '(is_legacy = true AND level IS NULL) OR (is_legacy = false AND level BETWEEN 1 AND 4)',
  });

  pgm.addConstraint('categories', 'categories_level_parent_chk', {
    check: 'level IS NULL OR (level = 1 AND parent_id IS NULL) OR (level > 1 AND parent_id IS NOT NULL)',
  });

  // Case-insensitive sibling name uniqueness & (parent_id, code) uniqueness for active hierarchy
  pgm.sql(`
    CREATE UNIQUE INDEX categories_sibling_name_unique_idx
    ON categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name))
    WHERE is_legacy = false
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX categories_sibling_code_unique_idx
    ON categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
    WHERE is_legacy = false AND code IS NOT NULL
  `);

  // Trigger to enforce parent.level = child.level - 1 and prevent level > 4
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_category_hierarchy()
    RETURNS trigger AS $$
    DECLARE
      parent_level SMALLINT;
      parent_legacy BOOLEAN;
    BEGIN
      IF NEW.is_legacy = true THEN
        RETURN NEW;
      END IF;

      IF NEW.level IS NULL OR NEW.level < 1 OR NEW.level > 4 THEN
        RAISE EXCEPTION 'Category level must be between 1 and 4';
      END IF;

      IF NEW.level = 1 THEN
        IF NEW.parent_id IS NOT NULL THEN
          RAISE EXCEPTION 'Level 1 categories cannot have a parent';
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.parent_id IS NULL THEN
        RAISE EXCEPTION 'Level % category requires a parent_id', NEW.level;
      END IF;

      SELECT level, is_legacy INTO parent_level, parent_legacy
      FROM categories
      WHERE id = NEW.parent_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent category % not found', NEW.parent_id;
      END IF;

      IF parent_legacy = true THEN
        RAISE EXCEPTION 'Cannot attach a hierarchical category under a legacy category';
      END IF;

      IF parent_level IS DISTINCT FROM (NEW.level - 1) THEN
        RAISE EXCEPTION 'Invalid category hierarchy: parent level (%) must be %', parent_level, NEW.level - 1;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_enforce_category_hierarchy
    BEFORE INSERT OR UPDATE OF parent_id, level, is_legacy ON categories
    FOR EACH ROW
    EXECUTE FUNCTION enforce_category_hierarchy();
  `);

  // Seed the 19 fixed Level 1 government asset categories (idempotent)
  for (let i = 0; i < LEVEL_1_CATEGORIES.length; i++) {
    const [code, name] = LEVEL_1_CATEGORIES[i];
    const sortOrder = i + 1;
    const id = `10000000-0000-4000-8000-${String(sortOrder).padStart(12, '0')}`;
    const escapedName = name.replace(/'/g, "''");
    pgm.sql(`
      INSERT INTO categories (
        id, name, parent_id, level, code, is_system, is_legacy, sort_order,
        default_low_stock_threshold, default_loan_days, max_renewals
      )
      VALUES (
        '${id}', '${escapedName}', NULL, 1, '${code}', true, false, ${sortOrder},
        0, 7, 0
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // Recursive view for computed full_path, code_path, top_level info, ancestor_ids, and is_leaf
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
};

export const down = (pgm) => {
  pgm.sql('DROP VIEW IF EXISTS category_paths');
  pgm.sql('DROP TRIGGER IF EXISTS trg_enforce_category_hierarchy ON categories');
  pgm.sql('DROP FUNCTION IF EXISTS enforce_category_hierarchy()');
  pgm.sql('DROP INDEX IF EXISTS categories_sibling_code_unique_idx');
  pgm.sql('DROP INDEX IF EXISTS categories_sibling_name_unique_idx');
  pgm.dropConstraint('categories', 'categories_level_parent_chk', { ifExists: true });
  pgm.dropConstraint('categories', 'categories_level_range_chk', { ifExists: true });
  pgm.sql('DELETE FROM categories WHERE is_system = true AND level = 1');
  pgm.alterColumn('categories', 'default_loan_days', { default: null });
  pgm.dropColumns('categories', ['level', 'code', 'is_system', 'is_legacy', 'sort_order']);
};
