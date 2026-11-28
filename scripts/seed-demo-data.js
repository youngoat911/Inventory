import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!process.argv.includes('--confirm-render')) {
  throw new Error('Pass --confirm-render to seed the Render database.');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

let databaseHost;
try {
  databaseHost = new URL(databaseUrl).hostname;
} catch {
  throw new Error('DATABASE_URL must be a valid URL.');
}

if (!databaseHost.endsWith('.render.com') && !process.env.RENDER_SERVICE_ID) {
  throw new Error('Refusing to seed: use a Render database URL or run from a Render service.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
let transactionStarted = false;

try {
  await client.query('BEGIN');
  transactionStarted = true;

  const seedRows = [
    [
      `INSERT INTO org_units (id, type, name, code, is_active)
       VALUES ($1, 'club', '[DEMO] Robotics Club', 'DEMO-ROBOTICS', true)
       ON CONFLICT (id) DO NOTHING`,
      ['d0000000-0000-4000-8000-000000000001'],
    ],
    [
      `INSERT INTO users (id, full_name, institute_email, roll_no, phone, programme, is_active)
       VALUES
         ($1, '[DEMO] Inventory Manager', 'demo.manager@example.invalid', 'DEMO-MGR-001', '+10000000001', 'Engineering', true),
         ($2, '[DEMO] Borrower', 'demo.borrower@example.invalid', 'DEMO-BOR-001', '+10000000002', 'Engineering', true)
       ON CONFLICT (id) DO NOTHING`,
      ['d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003'],
    ],
    [
      `INSERT INTO user_roles (id, user_id, org_unit_id, role)
       VALUES
         ($1, 'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'berm_incharge'),
         ($2, 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'borrower')
       ON CONFLICT (id) DO NOTHING`,
      ['d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005'],
    ],
    [
      `INSERT INTO categories (
         id, name, parent_id, level, code, is_system, is_legacy, sort_order,
         default_low_stock_threshold, default_loan_days, max_renewals
       )
       VALUES
         ('d0000000-0000-4000-8000-000000000010', '[DEMO] Cameras', '10000000-0000-4000-8000-000000000011', 2, '01', false, false, 1, 1, 7, 1),
         ('d0000000-0000-4000-8000-000000000011', '[DEMO] Audio Equipment', '10000000-0000-4000-8000-000000000011', 2, '02', false, false, 2, 2, 7, 1),
         ('d0000000-0000-4000-8000-000000000012', '[DEMO] Computers', '10000000-0000-4000-8000-000000000012', 2, '01', false, false, 1, 0, 7, 0),
         ('d0000000-0000-4000-8000-000000000013', '[DEMO] Desktops', 'd0000000-0000-4000-8000-000000000012', 3, '01', false, false, 1, 0, 7, 0),
         ('d0000000-0000-4000-8000-000000000014', '[DEMO] All-in-One', 'd0000000-0000-4000-8000-000000000013', 4, '01', false, false, 1, 0, 7, 0),
         ('d0000000-0000-4000-8000-000000000015', '[DEMO] Physics Lab', '10000000-0000-4000-8000-000000000009', 2, '01', false, false, 1, 0, 7, 0),
         ('d0000000-0000-4000-8000-000000000016', '[DEMO] Oscilloscopes', 'd0000000-0000-4000-8000-000000000015', 3, '01', false, false, 1, 0, 7, 0)
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
    [
      `INSERT INTO locations (id, name, type, building, floor, room_number, org_unit_id, is_active)
       VALUES
         ('d0000000-0000-4000-8000-000000000020', '[DEMO] Equipment Room', 'storage', 'Main Building', '1', '101', 'd0000000-0000-4000-8000-000000000001', true),
         ('d0000000-0000-4000-8000-000000000021', '[DEMO] Media Lab', 'lab', 'Main Building', '2', '204', 'd0000000-0000-4000-8000-000000000001', true)
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
    [
      `INSERT INTO vendors (id, name, code, email, city, country, is_active)
       VALUES ('d0000000-0000-4000-8000-000000000030', '[DEMO] Sample Supplier', 'DEMO-SUPPLIER', 'supplier@example.invalid', 'Sample City', 'Sample Country', true)
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
    [
      `INSERT INTO assets (
         id, asset_tag, name, description, category_id, tracking, quantity,
         low_stock_threshold, unit_cost, brand_model, condition, status,
         owner_org_id, location_id, responsible_user_id, is_issuable, is_institute_asset
       )
       VALUES
         ('d0000000-0000-4000-8000-000000000040', 'DEMO-ASSET-001', '[DEMO] DSLR Camera', 'Sample individually tracked camera', 'd0000000-0000-4000-8000-000000000010', 'individual', 1, 0, 650.00, 'SampleCam X1', 'good', 'issued', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000002', true, true),
         ('d0000000-0000-4000-8000-000000000041', 'DEMO-ASSET-002', '[DEMO] Tripod', 'Sample quantity-tracked tripods', 'd0000000-0000-4000-8000-000000000010', 'quantity', 6, 1, 35.00, 'SampleStand T2', 'excellent', 'available', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000002', true, true),
         ('d0000000-0000-4000-8000-000000000042', 'DEMO-ASSET-003', '[DEMO] Wireless Microphone Kit', 'Sample audio kit with low stock', 'd0000000-0000-4000-8000-000000000011', 'quantity', 1, 2, 120.00, 'SampleMic M3', 'good', 'available', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000002', true, true)
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
    [
      `INSERT INTO issues (id, asset_id, quantity, borrower_id, purpose, status, issued_at, due_at, issued_by)
       VALUES (
         'd0000000-0000-4000-8000-000000000050',
         'd0000000-0000-4000-8000-000000000040',
         1,
         'd0000000-0000-4000-8000-000000000003',
         'Demo loan record',
         'active',
         now(),
         now() + interval '7 days',
         'd0000000-0000-4000-8000-000000000002'
       )
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
    [
      `INSERT INTO alerts (id, type, status, severity, message, title, entity_type, entity_id, asset_id)
       VALUES (
         'd0000000-0000-4000-8000-000000000060',
         'low_stock',
         'open',
         'medium',
         '[DEMO] Sample quantity is below its configured threshold.',
         '[DEMO] Low stock: Wireless Microphone Kit',
         'asset',
         'd0000000-0000-4000-8000-000000000042',
         'd0000000-0000-4000-8000-000000000042'
       )
       ON CONFLICT (id) DO NOTHING`,
      [],
    ],
  ];

  for (const [sql, values] of seedRows) {
    await client.query(sql, values);
  }

  await client.query('COMMIT');
  transactionStarted = false;
  console.log('Demo inventory data seeded. Existing records were not deleted or overwritten.');
} catch (error) {
  if (transactionStarted) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
  }
  console.error('Demo data seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
