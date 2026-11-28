import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestUser, createTestCategory, cleanupTestData } from '../helpers/fixtures.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import transfersRouter from '../../src/modules/transfers/transfers.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use('/api/v1/transfers', authenticate, transfersRouter);
app.use(errorHandler);

describe('Issue-management transfer (hand-over to a new person in-charge)', () => {
  let admin;
  let category;
  let asset;
  const auth = () => ({ Authorization: `Bearer mock.token.${admin.id}` });

  beforeAll(async () => {
    admin = await createTestUser();
    category = await createTestCategory();
    const res = await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send({
        name: 'Test Asset Hand-over',
        category_id: category.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'good',
        status: 'available',
        issued_to: 'Physics Lab',
        incharge_name: 'Old Incharge',
        incharge_phone: '1111111111',
      })
      .expect(201);
    asset = res.body.data;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('requires some destination', async () => {
    await request(app)
      .post('/api/v1/transfers')
      .set(auth())
      .send({ asset_id: asset.id, quantity: 1, reason: 'nothing' })
      .expect(422);
  });

  it('snapshots the current custody and applies the new one on completion', async () => {
    const created = await request(app)
      .post('/api/v1/transfers')
      .set(auth())
      .send({
        asset_id: asset.id,
        quantity: 1,
        to_issued_to: 'Chemistry Lab',
        to_incharge_name: 'New Incharge',
        to_incharge_phone: '2222222222',
        reason: 'Lab reallocation',
      })
      .expect(201);

    const t = created.body.data;
    expect(t).toMatchObject({
      from_issued_to: 'Physics Lab',
      from_incharge_name: 'Old Incharge',
      from_incharge_phone: '1111111111',
      to_issued_to: 'Chemistry Lab',
      to_incharge_name: 'New Incharge',
    });

    await request(app).post(`/api/v1/transfers/${t.id}/approve`).set(auth()).send({}).expect(200);
    await request(app).post(`/api/v1/transfers/${t.id}/complete`).set(auth()).send({}).expect(200);

    const after = await request(app).get(`/api/v1/assets/${asset.id}`).set(auth()).expect(200);
    expect(after.body.data).toMatchObject({
      issued_to: 'Chemistry Lab',
      incharge_name: 'New Incharge',
      incharge_phone: '2222222222',
    });
  });
});
