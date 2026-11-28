// Bulk import of assets from spreadsheet rows (parsed from CSV on the client).
//
// Rows are plain objects keyed by column header. Headers are matched loosely
// (case, spacing and punctuation are ignored) so a file exported from this app,
// the downloadable template, or a hand-made sheet all work. Human-readable
// values (category path / code, location name, status label, "Yes"/"No",
// DD/MM/YYYY dates...) are resolved to IDs and codes here.

import { pool } from '../../db/pool.js';
import { AppError } from '../../shared/app-error.js';
import { BUDGET_TYPES } from '../../config/constants.js';
import { createAssetSchema } from './assets.schemas.js';
import * as repository from './assets.repository.js';

export const MAX_IMPORT_ROWS = 2000;

// Canonical field -> accepted header spellings (normalised: lowercase alphanumerics only)
const HEADER_ALIASES = {
  asset_tag: ['assettag', 'uniquenumber', 'uniqueno', 'tag', 'itemno', 'itemnumber'],
  name: ['name', 'itemname', 'assetname'],
  description: ['description', 'details'],
  category_id: ['categoryid'],
  category_code: ['categorycode', 'code', 'codepath'],
  category_path: ['categorypath', 'category', 'fullcategory'],
  broad_category: ['broadcategorygroup', 'broadcategory', 'level1', 'categorygroup'],
  main_category: ['maincategory', 'level2'],
  sub_category: ['subcategory', 'level3'],
  item_master: ['itemmaster', 'level4'],
  tracking: ['tracking', 'trackingmode'],
  quantity: ['quantity', 'qty'],
  low_stock_threshold: ['lowstockthreshold', 'lowstock'],
  cost: ['cost', 'price', 'value', 'amount'],
  unit_cost: ['unitcost'],
  capitalization_date: ['capitalizationdate', 'capitalisationdate', 'purchasedate'],
  serial_no: ['serialnumber', 'serialno', 'serial'],
  brand_model: ['brandmodel', 'brand', 'model', 'make'],
  condition: ['condition'],
  status: ['status'],
  owner_org: ['ownerorganization', 'ownerorganisation', 'ownerorg', 'department', 'orgunit'],
  location: ['location', 'locationname', 'room'],
  is_issuable: ['canbeloaned', 'loanable', 'isissuable', 'issuable'],
  is_institute_asset: ['isinstituteasset', 'instituteasset'],
  warranty_until: ['warrantyuntil', 'warranty', 'warrantyexpiry'],
  issued_to: ['issuedto'],
  incharge_name: ['personincharge', 'incharge', 'inchargename', 'personinchargename'],
  incharge_phone: ['inchargephone', 'inchargephoneno', 'inchargenumber', 'inchargetelnumber', 'phone', 'contactnumber'],
  invoice_no: ['invoiceno', 'invoicenumber', 'invoice'],
  invoice_date: ['invoicedate'],
  budget_type: ['budgettype', 'fundingsource'],
  budget_head: ['budgethead', 'budget', 'sponsor', 'donor', 'project'],
};

const ALIAS_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => aliases.map((a) => [a, field]))
);

const BUDGET_ALIASES = {
  institute: 'institute', institutebudget: 'institute', institutional: 'institute',
  rd: 'r_and_d', randd: 'r_and_d', research: 'r_and_d', researchanddevelopment: 'r_and_d',
  sponsor: 'sponsored', sponsored: 'sponsored', sponsorship: 'sponsored',
  donation: 'donation', donated: 'donation', donor: 'donation',
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function blank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/** Map arbitrary headers to canonical field names, dropping unknown columns. */
export function mapRow(raw) {
  const out = {};
  for (const [header, value] of Object.entries(raw || {})) {
    const field = ALIAS_LOOKUP.get(norm(header));
    if (field && !blank(value)) out[field] = String(value).trim();
  }
  return out;
}

function parseNumber(v, label) {
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`${label} "${v}" is not a number`);
  return n;
}

function parseBool(v, label) {
  const s = norm(v);
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  throw new Error(`${label} "${v}" must be Yes or No`);
}

/** Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY and DD.MM.YYYY. */
export function parseDate(v, label) {
  const s = String(v).trim();
  let y, m, d;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = match;
  else throw new Error(`${label} "${v}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`);
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) {
    throw new Error(`${label} "${v}" is not a valid date`);
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Load the lookup tables needed to resolve human-readable values. */
async function loadLookups(client) {
  const [cats, locs, orgs, masters] = await Promise.all([
    client.query('SELECT id, name, level, code_path, full_path, is_leaf, is_legacy FROM category_paths'),
    client.query('SELECT id, name, org_unit_id FROM locations WHERE is_active'),
    client.query('SELECT id, name, code FROM org_units WHERE is_active'),
    client.query('SELECT kind, code, label FROM asset_status_master WHERE is_active'),
  ]);

  const byKey = (rows, keyFn) => {
    const map = new Map();
    for (const row of rows) {
      for (const key of new Set([keyFn(row)].flat().filter(Boolean))) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
    }
    return map;
  };

  return {
    categoriesById: new Map(cats.rows.map((c) => [c.id, c])),
    categoriesByCode: byKey(cats.rows, (c) => c.code_path && norm(c.code_path)),
    categoriesByPath: byKey(cats.rows, (c) => normPath(c.full_path)),
    leavesByName: byKey(cats.rows.filter((c) => c.is_leaf && !c.is_legacy && c.level >= 2), (c) => norm(c.name)),
    locations: byKey(locs.rows, (l) => norm(l.name)),
    orgs: byKey(orgs.rows, (o) => [norm(o.name), norm(o.code)]),
    statuses: byKey(masters.rows.filter((m) => m.kind === 'status'), (m) => [m.code, norm(m.label), norm(m.code)]),
    conditions: byKey(masters.rows.filter((m) => m.kind === 'condition'), (m) => [m.code, norm(m.label), norm(m.code)]),
  };
}

function normPath(p) {
  return String(p ?? '')
    .split(/\s*[>/]\s*/)
    .map(norm)
    .filter(Boolean)
    .join('>');
}

function only(matches, what, value) {
  if (!matches || matches.length === 0) throw new Error(`${what} "${value}" not found`);
  if (matches.length > 1) throw new Error(`${what} "${value}" is ambiguous; use the full path or code`);
  return matches[0];
}

function resolveCategory(row, lk) {
  let cat;
  if (row.category_id) {
    cat = lk.categoriesById.get(row.category_id);
    if (!cat) throw new Error(`Category id "${row.category_id}" not found`);
  } else if (row.category_code) {
    cat = only(lk.categoriesByCode.get(norm(row.category_code)), 'Category code', row.category_code);
  } else if (row.category_path) {
    const matches = lk.categoriesByPath.get(normPath(row.category_path))
      || lk.leavesByName.get(norm(row.category_path));
    cat = only(matches, 'Category', row.category_path);
  } else if (row.broad_category || row.main_category || row.sub_category || row.item_master) {
    const parts = [row.broad_category, row.main_category, row.sub_category, row.item_master].filter(Boolean);
    const path = parts.join(' > ');
    const matches = row.broad_category
      ? lk.categoriesByPath.get(normPath(path))
      : lk.leavesByName.get(norm(parts[parts.length - 1]));
    cat = only(matches, 'Category', path);
  } else {
    throw new Error('Category is required (Category Code, Category Path, or the level columns)');
  }
  if (cat.is_legacy || !cat.level || cat.level < 2 || !cat.is_leaf) {
    throw new Error(`Category "${cat.full_path}" is not a last-level category`);
  }
  return cat.id;
}

function resolveMaster(map, value, kind, fallback) {
  if (blank(value)) return fallback;
  const hit = map.get(String(value).trim()) || map.get(norm(value));
  return only(hit, kind, value).code;
}

/** Turn one raw spreadsheet row into a validated createAsset payload. */
function buildAsset(raw, lk, orgIds) {
  const row = mapRow(raw);
  if (Object.keys(row).length === 0) return null; // blank line

  const asset = {
    asset_tag: row.asset_tag,
    name: row.name,
    description: row.description,
    category_id: resolveCategory(row, lk),
    tracking: blank(row.tracking) ? undefined : norm(row.tracking).startsWith('q') ? 'quantity' : 'individual',
    serial_no: row.serial_no,
    brand_model: row.brand_model,
    status: resolveMaster(lk.statuses, row.status, 'Status', 'available'),
    condition: resolveMaster(lk.conditions, row.condition, 'Condition', 'good'),
    issued_to: row.issued_to,
    incharge_name: row.incharge_name,
    incharge_phone: row.incharge_phone,
    invoice_no: row.invoice_no,
    budget_head: row.budget_head,
  };

  if (!blank(row.quantity)) asset.quantity = parseNumber(row.quantity, 'Quantity');
  if (!blank(row.low_stock_threshold)) asset.low_stock_threshold = parseNumber(row.low_stock_threshold, 'Low stock threshold');
  if (!blank(row.cost)) asset.cost = parseNumber(row.cost, 'Cost');
  if (!blank(row.unit_cost)) asset.unit_cost = parseNumber(row.unit_cost, 'Unit cost');
  if (!blank(row.capitalization_date)) asset.capitalization_date = parseDate(row.capitalization_date, 'Capitalization date');
  if (!blank(row.warranty_until)) asset.warranty_until = parseDate(row.warranty_until, 'Warranty until');
  if (!blank(row.invoice_date)) asset.invoice_date = parseDate(row.invoice_date, 'Invoice date');
  if (!blank(row.is_issuable)) asset.is_issuable = parseBool(row.is_issuable, 'Can be loaned');
  if (!blank(row.is_institute_asset)) asset.is_institute_asset = parseBool(row.is_institute_asset, 'Is institute asset');

  if (asset.tracking === undefined) asset.tracking = (asset.quantity ?? 1) === 1 ? 'individual' : 'quantity';
  if (asset.quantity === undefined) asset.quantity = 1;

  if (!blank(row.budget_type)) {
    const bt = BUDGET_TYPES.includes(row.budget_type) ? row.budget_type : BUDGET_ALIASES[norm(row.budget_type)];
    if (!bt) throw new Error(`Budget type "${row.budget_type}" must be Institute, R&D, Sponsored or Donation`);
    asset.budget_type = bt;
  }

  if (!blank(row.location)) {
    const loc = only(lk.locations.get(norm(row.location)), 'Location', row.location);
    if (orgIds !== null && (!loc.org_unit_id || !orgIds.includes(loc.org_unit_id))) {
      throw new Error(`Location "${row.location}" is outside your organization scope`);
    }
    asset.location_id = loc.id;
  }

  if (!blank(row.owner_org)) {
    asset.owner_org_id = only(lk.orgs.get(norm(row.owner_org)), 'Owner organization', row.owner_org).id;
  }
  if (orgIds !== null) {
    if (asset.owner_org_id && !orgIds.includes(asset.owner_org_id)) {
      throw new Error(`Owner organization "${row.owner_org}" is outside your scope`);
    }
    if (!asset.owner_org_id) {
      if (orgIds.length === 0) throw new Error('You have no organization assigned to own imported items');
      asset.owner_org_id = orgIds[0];
    }
  }

  // Drop undefined keys so schema defaults apply, then validate like a normal create
  const cleaned = Object.fromEntries(Object.entries(asset).filter(([, v]) => v !== undefined));
  const parsed = createAssetSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; '));
  }
  if (parsed.data.tracking === 'individual' && parsed.data.quantity !== 1) {
    throw new Error('Individually tracked items must have quantity 1 (use tracking "quantity" for bulk items)');
  }
  return parsed.data;
}

/**
 * Import rows. All-or-nothing: if any row fails, nothing is saved and every
 * row's error is returned. With dryRun the rows are fully checked (including
 * duplicate numbers within the file) and then rolled back.
 *
 * @param {object[]} rows   raw spreadsheet rows keyed by header
 * @param {{dryRun?: boolean, orgIds: string[]|null}} options  orgIds: null = unrestricted
 */
export async function importAssets(rows, { dryRun = false, orgIds = null } = {}) {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError('IMPORT_TOO_LARGE', `At most ${MAX_IMPORT_ROWS} rows can be imported at once`, 422);
  }

  const client = await pool.connect();
  const errors = [];
  const created = [];
  let skipped = 0;
  try {
    await client.query('BEGIN');
    const lk = await loadLookups(client);

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 for 1-based, +1 for the header line
      let asset;
      try {
        asset = buildAsset(rows[i], lk, orgIds);
      } catch (error) {
        errors.push({ row: rowNumber, error: error.message });
        continue;
      }
      if (!asset) {
        skipped++;
        continue;
      }

      await client.query('SAVEPOINT import_row');
      try {
        if (asset.asset_tag) {
          const { rows: dup } = await client.query('SELECT 1 FROM assets WHERE asset_tag = $1', [asset.asset_tag]);
          if (dup.length) throw new Error(`Unique number "${asset.asset_tag}" already exists`);
        } else {
          asset.asset_tag = await repository.nextAssetTag(asset.category_id, client);
        }
        if (asset.serial_no) {
          const { rows: dup } = await client.query('SELECT 1 FROM assets WHERE serial_no = $1', [asset.serial_no]);
          if (dup.length) throw new Error(`Serial number "${asset.serial_no}" already exists`);
        }
        const inserted = await repository.create(asset, client);
        created.push({ row: rowNumber, id: inserted.id, asset_tag: inserted.asset_tag, name: inserted.name });
        await client.query('RELEASE SAVEPOINT import_row');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT import_row');
        errors.push({ row: rowNumber, error: error.message });
      }
    }

    const ok = errors.length === 0;
    await client.query(ok && !dryRun ? 'COMMIT' : 'ROLLBACK');
    return {
      dry_run: dryRun,
      committed: ok && !dryRun,
      total_rows: rows.length,
      valid_rows: created.length,
      skipped_blank_rows: skipped,
      // In a dry run / failed import the generated numbers were not kept
      created: ok && !dryRun ? created : created.map(({ row, name }) => ({ row, name })),
      errors,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
