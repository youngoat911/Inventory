import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pool } from '../../src/db/pool.js';
import { createTestUser, createTestCategory, cleanupTestData } from '../helpers/fixtures.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use(errorHandler);

const base = (category, extra = {}) => ({
  name: 'Test Asset Unique Number',
  category_id: category.id,
  tracking: 'individual',
  quantity: 1,
  condition: 'good',
  status: 'available',
  ...extra,
});

describe('Auto-generated unique number', () => {
  let admin;
  let category;
  let prefix;
  const auth = () => ({ Authorization: `Bearer mock.token.${admin.id}` });

  beforeAll(async () => {
    admin = await createTestUser();
    category = await createTestCategory();
    const { rows } = await pool.query('SELECT code_path FROM category_paths WHERE id = $1', [category.id]);
    prefix = rows[0].code_path;
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.query('DELETE FROM asset_tag_sequences WHERE prefix = $1', [prefix]);
  });

  it('generates sequential numbers from the category code path', async () => {
    const a = await request(app).post('/api/v1/assets').set(auth()).send(base(category)).expect(201);
    const b = await request(app).post('/api/v1/assets').set(auth()).send(base(category)).expect(201);
    expect(a.body.data.asset_tag).toBe(`${prefix}-0001`);
    expect(b.body.data.asset_tag).toBe(`${prefix}-0002`);
  });

  it('keeps a manually entered number and skips it when generating', async () => {
    await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send(base(category, { asset_tag: `${prefix}-0003` }))
      .expect(201);
    const next = await request(app).post('/api/v1/assets').set(auth()).send(base(category)).expect(201);
    expect(next.body.data.asset_tag).toBe(`${prefix}-0004`);
  });

  it('numbers batch-created items too', async () => {
    const res = await request(app)
      .post('/api/v1/assets/batch-create')
      .set(auth())
      .send({ assets: [base(category), base(category)] })
      .expect(201);
    expect(res.body.data.map((a) => a.asset_tag)).toEqual([`${prefix}-0005`, `${prefix}-0006`]);
  });
});
