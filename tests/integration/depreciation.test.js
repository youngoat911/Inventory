import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pool } from '../../src/db/pool.js';
import { createTestUser, createTestOrgUnit, cleanupTestData } from '../helpers/fixtures.js';
import categoriesRouter from '../../src/modules/categories/categories.routes.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import reportsRouter from '../../src/modules/reports/reports.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/categories', authenticate, categoriesRouter);
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use('/api/v1', authenticate, reportsRouter);
app.use(errorHandler);

const COMPUTERS_L1_ID = '10000000-0000-4000-8000-000000000012';
const LAND_L1_ID = '10000000-0000-4000-8000-000000000001';

const EXPECTED_LEVEL_1_RATES = [
  ['01', 'Land', 0, null],
  ['02', 'Site Development', 0, null],
  ['03', 'Buildings', 2, null],
  ['04', 'Roads and Bridges', 2, null],
  ['05', 'Tubewell & Water Supply', 2, null],
  ['06', 'Sewage and Drainage', 2, null],
  ['07', 'Electrical Installation and Equipment', 5, null],
  ['08', 'Plant and Machinery', 5, null],
  ['09', 'Scientific and Laboratory Equipment', 8, null],
  ['10', 'Office Equipment', 7.5, null],
  ['11', 'Audio Visual Equipment', 7.5, null],
  ['12', 'Computers and Peripherals', 20, null],
  ['13', 'Furniture, Fixtures and Fittings', 7.5, null],
  ['14', 'Vehicles', 10, null],
  ['15', 'Library Books', 10, null],
  ['16', 'Small Value Assets', 100, null],
  ['17', 'Computer Software', 40, null],
  ['18', 'E-Journals', 40, null],
  ['19', 'Patents', null, 9],
];

async function createUserWithRole(role, orgUnitId = null) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, institute_email, roll_no, phone, programme, password_hash, is_active)
     VALUES ($1, $2, $3, '+1234567890', 'CS', '$argon2id$v=19$m=65536,t=3,p=4$test', true)
     RETURNING *`,
    [`Test ${role} ${suffix}`, `test-dep-${role}-${suffix}@institute.edu`, `TD-${role}-${suffix}`]
  );
  await pool.query(
    'INSERT INTO user_roles (user_id, role, org_unit_id) VALUES ($1, $2, $3)',
    [rows[0].id, role, orgUnitId]
  );
  return rows[0];
}

describe('Depreciation & Schedule 4 Integration Tests', () => {
  let superAdmin;
  let orgAdmin;
  let auditor;
  let borrower;
  let testOrg;
  let compSubCat;
  let landSubCat;
  let asset1;
  let asset2;

  beforeAll(async () => {
    superAdmin = await createTestUser();
    testOrg = await createTestOrgUnit();
    orgAdmin = await createUserWithRole('org_admin', testOrg.id);
    auditor = await createUserWithRole('auditor');
    borrower = await createUserWithRole('borrower');
  });

  afterAll(async () => {
    for (const a of [asset1, asset2]) {
      if (a) await pool.query('DELETE FROM assets WHERE id = $1', [a.id]);
    }
    for (const c of [compSubCat, landSubCat]) {
      if (c) await pool.query('DELETE FROM categories WHERE id = $1', [c.id]);
    }
    await cleanupTestData();
  });

  it('seeded Level 1 rates match the 19 government categories exactly', async () => {
    const res = await request(app)
      .get('/api/v1/categories?level=1&limit=50')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .expect(200);

    expect(res.body.data).toHaveLength(19);
    res.body.data.forEach((row, idx) => {
      const [code, name, rate, life] = EXPECTED_LEVEL_1_RATES[idx];
      expect(row.code).toBe(code);
      expect(row.name).toBe(name);
      expect(row.dep_rate_percent !== null ? Number(row.dep_rate_percent) : null).toBe(rate);
      expect(row.amortization_life_years).toBe(life);
    });
  });

  it('Levels 2-4 inherit Level 1 rate and reject rate overrides via API', async () => {
    // Reject override on create
    const rejectCreate = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Category Custom Rate',
        parent_id: COMPUTERS_L1_ID,
        dep_rate_percent: 33,
      })
      .expect(400);
    expect(rejectCreate.body.error.code).toBe('RATE_OVERRIDE_FORBIDDEN');

    // Create valid Level 2 under Computers (20%)
    const okCreate = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Category Workstations',
        parent_id: COMPUTERS_L1_ID,
        code: '88',
      })
      .expect(201);
    compSubCat = okCreate.body.data;
    expect(compSubCat.effective_dep_rate_percent).toBe(20);

    // Reject override on update
    const rejectPatch = await request(app)
      .patch(`/api/v1/categories/${compSubCat.id}`)
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ dep_rate_percent: 15 })
      .expect(400);
    expect(rejectPatch.body.error.code).toBe('RATE_OVERRIDE_FORBIDDEN');

    const landRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Category Campus Plot',
        parent_id: LAND_L1_ID,
        code: '88',
      })
      .expect(201);
    landSubCat = landRes.body.data;
    expect(landSubCat.effective_dep_rate_percent).toBe(0);
  });

  it('exposes depreciation fields on assets and matches Schedule 4 report totals', async () => {
    const a1Res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Asset Workstation 1',
        category_id: compSubCat.id,
        tracking: 'individual',
        quantity: 1,
        cost: 100000,
        capitalization_date: '2024-05-10', // FY 2024-25 -> 2025
        condition: 'excellent',
        status: 'available',
        owner_org_id: testOrg.id,
      })
      .expect(201);
    asset1 = a1Res.body.data;
    expect(asset1.effective_dep_rate_percent).toBe(20);
    expect(asset1.accumulated_depreciation).toBeGreaterThanOrEqual(20000);
    expect(asset1.current_book_value).toBe(100000 - asset1.accumulated_depreciation);

    const a2Res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Asset North Plot',
        category_id: landSubCat.id,
        tracking: 'individual',
        quantity: 1,
        cost: 500000,
        capitalization_date: '2025-06-01', // FY 2025-26 -> 2026
        condition: 'good',
        status: 'available',
        owner_org_id: testOrg.id,
      })
      .expect(201);
    asset2 = a2Res.body.data;

    // Role check: borrower forbidden on depreciation report
    await request(app)
      .get('/api/v1/reports/depreciation?fy=2025-26')
      .set('Authorization', `Bearer mock.token.${borrower.id}`)
      .expect(403);

    // org_admin and auditor allowed
    const reportRes = await request(app)
      .get(`/api/v1/reports/depreciation?fy=2025-26&org_unit_id=${testOrg.id}`)
      .set('Authorization', `Bearer mock.token.${orgAdmin.id}`)
      .expect(200);

    const rows = reportRes.body.data;
    expect(rows).toHaveLength(19);

    const compRow = rows.find((r) => r.category_code === '12');
    expect(compRow.opening_gross_block).toBe(100000);
    expect(compRow.additions).toBe(0);
    expect(compRow.closing_gross_block).toBe(100000);
    expect(compRow.opening_accumulated_depreciation).toBe(20000);
    expect(compRow.depreciation_for_year).toBe(20000);
    expect(compRow.closing_accumulated_depreciation).toBe(40000);
    expect(compRow.net_block).toBe(60000);

    const landRow = rows.find((r) => r.category_code === '01');
    expect(landRow.additions).toBe(500000);
    expect(landRow.depreciation_for_year).toBe(0);
    expect(landRow.net_block).toBe(500000);

    await request(app)
      .get('/api/v1/reports/depreciation?fy=2025-26')
      .set('Authorization', `Bearer mock.token.${auditor.id}`)
      .expect(200);
  });
});
