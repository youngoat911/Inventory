import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTestUser, createTestCategory, cleanupTestData } from '../helpers/fixtures.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';

const app = express();
app.use(express.json());
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use(errorHandler);

describe('Asset custody, invoice and budget fields', () => {
  let admin;
  let category;
  let assetId;
  const auth = () => ({ Authorization: `Bearer mock.token.${admin.id}` });

  beforeAll(async () => {
    admin = await createTestUser();
    category = await createTestCategory();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('stores issued-to, in-charge, invoice and budget details', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .set(auth())
      .send({
        name: 'Test Asset Custody',
        category_id: category.id,
        tracking: 'individual',
        quantity: 1,
        condition: 'good',
        status: 'available',
        issued_to: 'Robotics Lab',
        incharge_name: 'Dr. Test',
        incharge_phone: '+91 98765 43210',
        invoice_no: 'INV-TEST-001',
        invoice_date: '2026-04-15',
        budget_type: 'r_and_d',
        budget_head: 'SERB Grant 42',
      })
      .expect(201);

    assetId = res.body.data.id;
    expect(res.body.data).toMatchObject({
      issued_to: 'Robotics Lab',
      incharge_name: 'Dr. Test',
      incharge_phone: '+91 98765 43210',
      invoice_no: 'INV-TEST-001',
      budget_type: 'r_and_d',
      budget_head: 'SERB Grant 42',
    });
  });

  it('filters by budget type and searches by issued-to', async () => {
    const byBudget = await request(app).get('/api/v1/assets?budget_type=r_and_d&limit=100').set(auth()).expect(200);
    expect(byBudget.body.data.some((a) => a.id === assetId)).toBe(true);
    const other = await request(app).get('/api/v1/assets?budget_type=donation&limit=100').set(auth()).expect(200);
    expect(other.body.data.some((a) => a.id === assetId)).toBe(false);
    const search = await request(app).get('/api/v1/assets?q=Robotics%20Lab').set(auth()).expect(200);
    expect(search.body.data.some((a) => a.id === assetId)).toBe(true);
  });

  it('clears fields with null and rejects unknown budget types', async () => {
    const res = await request(app)
      .patch(`/api/v1/assets/${assetId}`)
      .set(auth())
      .send({ issued_to: null, budget_type: 'donation' })
      .expect(200);
    expect(res.body.data.issued_to).toBeNull();
    expect(res.body.data.budget_type).toBe('donation');

    await request(app).patch(`/api/v1/assets/${assetId}`).set(auth()).send({ budget_type: 'lottery' }).expect(422);
  });

  it('exports the new columns in CSV', async () => {
    const res = await request(app).get('/api/v1/assets/export?format=csv&q=INV-TEST-001').set(auth()).expect(200);
    expect(res.text).toContain('"Budget Type"');
    expect(res.text).toContain('"Invoice No"');
    expect(res.text).toContain('"INV-TEST-001"');
    expect(res.text).toContain('"2026-04-15"');
  });
});
