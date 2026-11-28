import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pool } from '../../src/db/pool.js';
import { createTestUser, createTestCategory, cleanupTestData } from '../helpers/fixtures.js';
import statusMasterRouter from '../../src/modules/status-master/status-master.routes.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/status-master', authenticate, statusMasterRouter);
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use(errorHandler);

describe('Status master', () => {
  let admin;
  let category;
  const auth = () => ({ Authorization: `Bearer mock.token.${admin.id}` });

  beforeAll(async () => {
    admin = await createTestUser();
    category = await createTestCategory();
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.query("DELETE FROM asset_status_master WHERE code LIKE 'test_%'");
  });

  it('lists seeded built-in statuses and conditions', async () => {
    const s = await request(app).get('/api/v1/status-master/status').set(auth()).expect(200);
    expect(s.body.data.map((r) => r.code)).toEqual(
      expect.arrayContaining(['available', 'issued', 'in_maintenance', 'disposed', 'lost', 'reserved'])
    );
    const c = await request(app).get('/api/v1/status-master/condition').set(auth()).expect(200);
    expect(c.body.data.find((r) => r.code === 'good')).toMatchObject({ is_system: true, label: 'Good' });
  });

  it('creates a custom condition usable on assets, and protects it while in use', async () => {
    const created = await request(app)
      .post('/api/v1/status-master/condition')
      .set(auth())
      .send({ code: 'test_good_maintenance', label: 'Good maintenance', color: 'ok' })
      .expect(201);
    expect(created.body.data.code).toBe('test_good_maintenance');

    const asset = await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send({
        name: 'Test Asset Status Master',
        category_id: category.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'test_good_maintenance',
        status: 'available',
      })
      .expect(201);
    expect(asset.body.data.condition).toBe('test_good_maintenance');

    await request(app)
      .delete('/api/v1/status-master/condition/test_good_maintenance')
      .set(auth())
      .expect(409);

    // Deactivated values are rejected for new assets
    await request(app)
      .patch('/api/v1/status-master/condition/test_good_maintenance')
      .set(auth())
      .send({ is_active: false })
      .expect(200);
    await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send({
        name: 'Test Asset Status Master 2',
        category_id: category.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'test_good_maintenance',
        status: 'available',
      })
      .expect(422);

    // ...but an asset already holding it can still be edited
    await request(app)
      .patch(`/api/v1/assets/${asset.body.data.id}`)
      .set(auth())
      .send({ name: 'Test Asset Status Master renamed', condition: 'test_good_maintenance' })
      .expect(200);
  });

  it('rejects unknown status values and protects built-ins', async () => {
    await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send({
        name: 'Test Asset Bad Status',
        category_id: category.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'good',
        status: 'test_nonexistent',
      })
      .expect(422);
    await request(app).delete('/api/v1/status-master/status/available').set(auth()).expect(400);
  });
});
