import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pool } from '../../src/db/pool.js';
import { createTestUser, createTestCategory, cleanupTestData } from '../helpers/fixtures.js';
import assetsRouter from '../../src/modules/assets/assets.routes.js';
import authenticate from '../../src/middlewares/auth.middleware.js';
import errorHandler from '../../src/middleware/error-handler.js';
import { parseDate, mapRow } from '../../src/modules/assets/assets.import.js';
import { csvToRecords } from '../../frontend/src/csv.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/v1/assets', authenticate, assetsRouter);
app.use(errorHandler);

describe('CSV asset import', () => {
  let admin;
  let category;
  let codePath;
  let fullPath;
  let location;
  const auth = () => ({ Authorization: `Bearer mock.token.${admin.id}` });

  beforeAll(async () => {
    admin = await createTestUser();
    category = await createTestCategory();
    const { rows } = await pool.query('SELECT code_path, full_path FROM category_paths WHERE id = $1', [category.id]);
    ({ code_path: codePath, full_path: fullPath } = rows[0]);
    const loc = await pool.query(
      "INSERT INTO locations (name, type) VALUES ($1, 'room') RETURNING *",
      [`Test Import Room ${Date.now()}`]
    );
    location = loc.rows[0];
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.query('DELETE FROM locations WHERE id = $1', [location.id]);
    await pool.query('DELETE FROM asset_tag_sequences WHERE prefix = $1', [codePath]);
  });

  it('maps loose headers and parses Indian date formats', () => {
    expect(mapRow({ 'Person In-charge': 'X', 'In-charge Phone': '1', 'Can Be Loaned': 'Yes', Junk: 'z' }))
      .toEqual({ incharge_name: 'X', incharge_phone: '1', is_issuable: 'Yes' });
    expect(parseDate('05/04/2026', 'd')).toBe('2026-04-05');
    expect(parseDate('2026-04-05', 'd')).toBe('2026-04-05');
    expect(() => parseDate('31/02/2026', 'd')).toThrow();
  });

  const goodRows = () => [
    {
      Name: 'Test Asset Import A',
      'Category Code': codePath,
      Cost: '₹1,250.50',
      Condition: 'Good',
      Status: 'available',
      Location: location.name.toUpperCase(),
      'Issued To': 'Lab 1',
      'Person In-charge': 'Ms. Import',
      'In-charge Phone': '9999999999',
      'Invoice No': 'INV-IMP-1',
      'Invoice Date': '15/04/2026',
      'Budget Type': 'R&D',
      'Can Be Loaned': 'No',
    },
    { Name: '', 'Category Code': '' }, // blank line is skipped
    {
      Name: 'Test Asset Import B',
      'Category Path': fullPath,
      Tracking: 'quantity',
      Quantity: '25',
      'Budget Type': 'Donation',
    },
  ];

  it('dry run validates without saving', async () => {
    const res = await request(app)
      .post('/api/v1/assets/import')
      .set(auth())
      .send({ rows: goodRows(), dry_run: true })
      .expect(200);
    expect(res.body.data).toMatchObject({ dry_run: true, committed: false, valid_rows: 2, skipped_blank_rows: 1 });
    const { rows } = await pool.query("SELECT 1 FROM assets WHERE name LIKE 'Test Asset Import%'");
    expect(rows).toHaveLength(0);
  });

  it('imports valid rows with resolved values and generated numbers', async () => {
    const res = await request(app).post('/api/v1/assets/import').set(auth()).send({ rows: goodRows() }).expect(201);
    expect(res.body.data.committed).toBe(true);
    expect(res.body.data.created.map((c) => c.asset_tag)).toEqual([`${codePath}-0001`, `${codePath}-0002`]);

    const { rows } = await pool.query(
      "SELECT * FROM assets WHERE name LIKE 'Test Asset Import%' ORDER BY name"
    );
    expect(rows[0]).toMatchObject({
      cost: '1250.50',
      condition: 'good',
      location_id: location.id,
      issued_to: 'Lab 1',
      incharge_name: 'Ms. Import',
      budget_type: 'r_and_d',
      is_issuable: false,
    });
    expect(rows[0].invoice_date.getDate()).toBe(15);
    expect(rows[1]).toMatchObject({ tracking: 'quantity', quantity: 25, budget_type: 'donation' });
  });

  it('rejects the whole file and reports every bad row', async () => {
    const res = await request(app)
      .post('/api/v1/assets/import')
      .set(auth())
      .send({
        rows: [
          { Name: 'Test Asset Import OK', 'Category Code': codePath },
          { Name: 'Test Asset Import Bad Cat', 'Category Code': 'nope-99' },
          { Name: 'Test Asset Import Bad Date', 'Category Code': codePath, 'Invoice Date': 'yesterday' },
          { Name: 'Test Asset Import Dup', 'Category Code': codePath, 'Unique Number': `${codePath}-0001` },
          { Name: 'Test Asset Import Bad Status', 'Category Code': codePath, Status: 'teleported' },
        ],
      })
      .expect(422);
    expect(res.body.data.committed).toBe(false);
    expect(res.body.data.errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(res.body.data.errors[2].error).toMatch(/already exists/);
    const { rows } = await pool.query("SELECT 1 FROM assets WHERE name = 'Test Asset Import OK'");
    expect(rows).toHaveLength(0);
  });

  it('round-trips a file exported from the Assets page', async () => {
    const exported = await request(app)
      .get('/api/v1/assets/export?format=csv&q=Test%20Asset%20Import%20A')
      .set(auth())
      .expect(200);
    const { records } = csvToRecords(exported.text);
    expect(records).toHaveLength(1);
    const row = records[0];
    row['Asset Tag'] = ''; // let it generate a new number
    row['Serial Number'] = '';
    const res = await request(app).post('/api/v1/assets/import').set(auth()).send({ rows: [row], dry_run: true });
    expect(res.body.data.errors).toEqual([]);
    expect(res.status).toBe(200);
  });
});
