import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pool } from '../../src/db/pool.js';
import { createTestUser, createTestAsset, cleanupTestData } from '../helpers/fixtures.js';
import categoriesRouter from '../../src/modules/categories/categories.routes.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/categories', authenticate, categoriesRouter);
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use(errorHandler);

const COMPUTERS_L1_ID = '10000000-0000-4000-8000-000000000012';
const SCIENTIFIC_L1_ID = '10000000-0000-4000-8000-000000000009';

async function createUserWithRole(role, orgUnitId = null) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, institute_email, roll_no, phone, programme, password_hash, is_active)
     VALUES ($1, $2, $3, '+1234567890', 'CS', '$argon2id$v=19$m=65536,t=3,p=4$test', true)
     RETURNING *`,
    [`Test ${role} ${suffix}`, `test-${role}-${suffix}@institute.edu`, `T-${role}-${suffix}`]
  );
  await pool.query(
    'INSERT INTO user_roles (user_id, role, org_unit_id) VALUES ($1, $2, $3)',
    [rows[0].id, role, orgUnitId]
  );
  return rows[0];
}

describe('Hierarchical Categories Integration Tests', () => {
  let superAdmin;
  let orgAdmin;
  let borrower;
  let auditor;

  let l2Node;
  let l3Node;
  let l4Node;
  let createdAsset;

  beforeAll(async () => {
    superAdmin = await createTestUser();
    orgAdmin = await createUserWithRole('org_admin');
    borrower = await createUserWithRole('borrower');
    auditor = await createUserWithRole('auditor');
  });

  afterAll(async () => {
    if (createdAsset) {
      await pool.query('DELETE FROM assets WHERE id = $1', [createdAsset.id]);
    }
    for (const node of [l4Node, l3Node, l2Node]) {
      if (node) {
        await pool.query('DELETE FROM categories WHERE id = $1', [node.id]);
      }
    }
    await cleanupTestData();
  });

  it('seeds all 19 fixed Level 1 categories in order', async () => {
    const res = await request(app)
      .get('/api/v1/categories?level=1&limit=50')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .expect(200);

    expect(res.body.data).toHaveLength(19);
    expect(res.body.data[0].code).toBe('01');
    expect(res.body.data[0].name).toBe('Land');
    expect(res.body.data[18].code).toBe('19');
    expect(res.body.data[18].name).toBe('Patents');
    expect(res.body.data.every((c) => c.is_system === true && c.level === 1)).toBe(true);
  });

  it('rejects creating, editing, or deleting Level 1 categories even for super_admin', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Fake L1', default_loan_days: 7 })
      .expect(403);
    expect(createRes.body.error.code).toBe('LEVEL_1_READ_ONLY');

    const patchRes = await request(app)
      .patch(`/api/v1/categories/${COMPUTERS_L1_ID}`)
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Renamed Computers' })
      .expect(403);
    expect(patchRes.body.error.code).toBe('LEVEL_1_READ_ONLY');

    const delRes = await request(app)
      .delete(`/api/v1/categories/${COMPUTERS_L1_ID}`)
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .expect(403);
    expect(delRes.body.error.code).toBe('LEVEL_1_READ_ONLY');
  });

  it('enforces role checks: borrower, auditor, and org_admin cannot mutate categories', async () => {
    for (const user of [borrower, auditor, orgAdmin]) {
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer mock.token.${user.id}`)
        .send({ name: 'Test Category Unauthorized', parent_id: COMPUTERS_L1_ID })
        .expect(403);
    }
  });

  it('creates Levels 2, 3, and 4 and rejects Level 5 or mismatched level', async () => {
    const r2 = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Laptops', parent_id: COMPUTERS_L1_ID, code: '90' })
      .expect(201);
    l2Node = r2.body.data;
    expect(l2Node.level).toBe(2);

    // Mismatched level (trying to create level 4 under level 2)
    await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Bad Level', parent_id: l2Node.id, level: 4 })
      .expect(400);

    const r3 = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Student Laptops', parent_id: l2Node.id, code: '01' })
      .expect(201);
    l3Node = r3.body.data;
    expect(l3Node.level).toBe(3);

    const r4 = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Dell', parent_id: l3Node.id, code: '01' })
      .expect(201);
    l4Node = r4.body.data;
    expect(l4Node.level).toBe(4);
    expect(l4Node.full_path).toBe(
      'Computers and Peripherals > Test Category Laptops > Test Category Student Laptops > Test Category Dell'
    );
    expect(l4Node.code_path).toBe('12-90-01-01');

    // Level 5 rejected
    const r5 = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'Test Category Level 5', parent_id: l4Node.id })
      .expect(400);
    expect(r5.body.error.code).toBe('MAX_CATEGORY_DEPTH');
  });

  it('rejects duplicate sibling names (case-insensitive)', async () => {
    const dupRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({ name: 'test category dell', parent_id: l3Node.id })
      .expect(409);
    expect(dupRes.body.error.code).toBe('CATEGORY_NAME_EXISTS');
  });

  it('returns breadcrumb array from GET /categories/:id/path', async () => {
    const res = await request(app)
      .get(`/api/v1/categories/${l4Node.id}/path`)
      .set('Authorization', `Bearer mock.token.${borrower.id}`)
      .expect(200);

    expect(res.body.data.map((n) => n.level)).toEqual([1, 2, 3, 4]);
    expect(res.body.data[0].name).toBe('Computers and Peripherals');
    expect(res.body.data[3].name).toBe('Test Category Dell');
  });

  it('rejects asset creation on non-leaf categories and succeeds on leaf, with ancestor filtering & tree counts', async () => {
    // Level 1 rejected
    await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Asset NonLeaf L1',
        category_id: SCIENTIFIC_L1_ID,
        tracking: 'quantity',
        quantity: 1,
        condition: 'good',
        status: 'available',
      })
      .expect(400);

    // Non-leaf Level 2 (has l3Node child) rejected
    const nonLeafRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Asset NonLeaf L2',
        category_id: l2Node.id,
        tracking: 'quantity',
        quantity: 1,
        condition: 'good',
        status: 'available',
      })
      .expect(400);
    expect(nonLeafRes.body.error.code).toBe('NON_LEAF_CATEGORY');

    // Leaf Level 4 succeeds
    const okRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .send({
        name: 'Test Asset Dell Latitude',
        category_id: l4Node.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'excellent',
        status: 'available',
      })
      .expect(201);
    createdAsset = okRes.body.data;

    // Asset detail includes category_path & top_level_category_name
    const detailRes = await request(app)
      .get(`/api/v1/assets/${createdAsset.id}`)
      .set('Authorization', `Bearer mock.token.${borrower.id}`)
      .expect(200);
    expect(detailRes.body.data.top_level_category_name).toBe('Computers and Peripherals');
    expect(detailRes.body.data.category_path).toContain('Test Category Dell');

    // Ancestor filter by Level 1 returns the Level 4 asset
    const listRes = await request(app)
      .get(`/api/v1/assets?category_id=${COMPUTERS_L1_ID}`)
      .set('Authorization', `Bearer mock.token.${borrower.id}`)
      .expect(200);
    expect(listRes.body.data.some((a) => a.id === createdAsset.id)).toBe(true);

    // GET /categories/tree has rolled-up asset_count
    const treeRes = await request(app)
      .get('/api/v1/categories/tree')
      .set('Authorization', `Bearer mock.token.${borrower.id}`)
      .expect(200);
    const compNode = treeRes.body.data.find((n) => n.id === COMPUTERS_L1_ID);
    expect(compNode).toBeDefined();
    expect(compNode.asset_count).toBeGreaterThanOrEqual(1);
    const l2InTree = compNode.children.find((n) => n.id === l2Node.id);
    expect(l2InTree.asset_count).toBe(1);
  });

  it('prevents deleting a category with children or assets and returns counts', async () => {
    const hasChildrenRes = await request(app)
      .delete(`/api/v1/categories/${l2Node.id}`)
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .expect(409);
    expect(hasChildrenRes.body.error.code).toBe('CATEGORY_HAS_CHILDREN');
    expect(hasChildrenRes.body.error.details[0]).toMatchObject({ children_count: 1, assets_count: 0 });

    const hasAssetsRes = await request(app)
      .delete(`/api/v1/categories/${l4Node.id}`)
      .set('Authorization', `Bearer mock.token.${superAdmin.id}`)
      .expect(409);
    expect(hasAssetsRes.body.error.code).toBe('CATEGORY_HAS_ASSETS');
    expect(hasAssetsRes.body.error.details[0]).toMatchObject({ children_count: 0, assets_count: 1 });
  });
});
