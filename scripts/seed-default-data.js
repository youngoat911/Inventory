import 'dotenv/config';
import argon2 from 'argon2';
import { pool } from '../src/db/pool.js';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gymkhana.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error('SEED_ADMIN_PASSWORD is required.');
}

const ids = {
  orgUnit: 'e0000000-0000-4000-8000-000000000001',
  user: 'e0000000-0000-4000-8000-000000000002',
  role: 'e0000000-0000-4000-8000-000000000003',
  category: 'e0000000-0000-4000-8000-000000000010',
  location: 'e0000000-0000-4000-8000-000000000020',
  asset: 'e0000000-0000-4000-8000-000000000030',
};

const client = await pool.connect();

try {
  await client.query('BEGIN');
  const passwordHash = await argon2.hash(adminPassword);

  await client.query(
    `INSERT INTO org_units (id, type, name, code)
     VALUES ($1, 'club', 'Gymkhana', 'GYMKHANA')
     ON CONFLICT (id) DO NOTHING`,
    [ids.orgUnit]
  );

  const { rows: users } = await client.query(
    `INSERT INTO users (id, full_name, institute_email, roll_no, password_hash)
     VALUES ($1, 'Gymkhana Administrator', $2, 'ADMIN-001', $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [ids.user, adminEmail, passwordHash]
  );

  if (!users.length) {
    const { rows: existingUsers } = await client.query(
      'SELECT id FROM users WHERE id = $1 AND institute_email = $2',
      [ids.user, adminEmail]
    );
    if (!existingUsers.length) {
      throw new Error(`The default admin ID is already assigned to a different user. Choose a different database or remove that user first.`);
    }
  }

  await client.query(
    `INSERT INTO user_roles (id, user_id, role)
     VALUES ($1, $2, 'super_admin')
     ON CONFLICT (id) DO NOTHING`,
    [ids.role, ids.user]
  );

  await client.query(
    `INSERT INTO categories (id, name, default_low_stock_threshold, default_loan_days, max_renewals)
     VALUES ($1, 'General Equipment', 2, 7, 1)
     ON CONFLICT (id) DO NOTHING`,
    [ids.category]
  );

  await client.query(
    `INSERT INTO locations (id, name, type, building, room_number, org_unit_id)
     VALUES ($1, 'Main Equipment Room', 'storage', 'Gymkhana', '101', $2)
     ON CONFLICT (id) DO NOTHING`,
    [ids.location, ids.orgUnit]
  );

  await client.query(
    `INSERT INTO assets (
       id, asset_tag, name, description, category_id, tracking, quantity,
       low_stock_threshold, condition, status, owner_org_id, location_id,
       responsible_user_id
     )
     VALUES (
       $1, 'GYM-001', 'Sample Equipment', 'Starter inventory record', $2,
       'quantity', 5, 2, 'good', 'available', $3, $4, $5
     )
     ON CONFLICT (id) DO NOTHING`,
    [ids.asset, ids.category, ids.orgUnit, ids.location, ids.user]
  );

  await client.query('COMMIT');
  console.log(`Default data seeded. Sign in with ${adminEmail}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
