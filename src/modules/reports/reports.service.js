import * as repository from './reports.repository.js';
import { stringify } from 'csv-stringify/sync';
import {
  formatFinancialYear,
  getDepreciation,
  getEffectiveDepRate,
  getFinancialYearEndYear,
  parseFinancialYear,
} from '../../shared/depreciation.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Dashboard services
export async function getDashboardSummary(borrowerId = null, orgIds = null) {
  const summary = await repository.getDashboardSummary(borrowerId, orgIds);
  return summary;
}

export async function getOrgDashboard(orgId) {
  const summary = await repository.getOrgDashboard(orgId);
  return summary;
}

// Report services
export async function getAssetInventoryReport(filters) {
  const assets = await repository.getAssetInventory(filters);
  
  if (filters.format === 'csv') {
    const records = assets.map(asset => ({
      'Asset Tag': asset.asset_tag || '',
      'Name': asset.name,
      'Category': asset.category_name || '',
      'Tracking': asset.tracking,
      'Quantity': asset.quantity,
      'Condition': asset.condition,
      'Status': asset.status,
      'Location': asset.location_name || '',
      'Owner Organization': asset.owner_org_name || '',
      'Unit Cost': asset.unit_cost || '',
      'Is Issuable': asset.is_issuable ? 'Yes' : 'No',
    }));

    return stringify(records, {
      header: true,
      quoted: true,
    });
  }

  return assets;
}

export async function getBorrowingHistoryReport(filters) {
  return repository.getBorrowingHistory(filters);
}

export async function getOverdueLoansReport(filters) {
  return repository.getOverdueLoans(filters);
}

export async function getMaintenanceCostsReport(filters) {
  return repository.getMaintenanceCosts(filters);
}

export async function getDisposalSummaryReport(filters) {
  return repository.getDisposalSummary(filters);
}

export async function getVerificationProgressReport(filters) {
  return repository.getVerificationProgress(filters);
}

export async function getAssetUtilizationReport(filters) {
  return repository.getAssetUtilization(filters);
}

export async function getDepreciationReport(filters = {}) {
  const fyEndYear = parseFinancialYear(filters.fy);
  const fyLabel = formatFinancialYear(fyEndYear);
  const { level1Categories, assets } = await repository.getDepreciationData(filters);

  const byTopCategory = new Map();
  for (const cat of level1Categories) {
    byTopCategory.set(cat.id, {
      category_id: cat.id,
      category_code: cat.code,
      category_name: cat.name,
      dep_rate_percent: cat.dep_rate_percent !== null ? Number(cat.dep_rate_percent) : null,
      amortization_life_years: cat.amortization_life_years,
      effective_dep_rate_percent: getEffectiveDepRate(cat),
      opening_gross_block: 0,
      additions: 0,
      deductions: 0,
      closing_gross_block: 0,
      opening_accumulated_depreciation: 0,
      depreciation_for_year: 0,
      closing_accumulated_depreciation: 0,
      net_block: 0,
    });
  }

  for (const asset of assets) {
    const row = byTopCategory.get(asset.top_level_id);
    if (!row) continue;

    const cost = asset.cost !== null && asset.cost !== undefined ? Number(asset.cost) : 0;
    if (!Number.isFinite(cost) || cost <= 0 || !asset.capitalization_date) continue;

    const capFy = getFinancialYearEndYear(asset.capitalization_date);
    if (capFy > fyEndYear) continue;

    const dispFy = asset.disposed_on ? getFinancialYearEndYear(asset.disposed_on) : null;
    if (dispFy !== null && dispFy < fyEndYear) continue;

    if (capFy < fyEndYear) {
      row.opening_gross_block = round2(row.opening_gross_block + cost);
      const prevDep = getDepreciation(asset, fyEndYear - 1);
      row.opening_accumulated_depreciation = round2(
        row.opening_accumulated_depreciation + prevDep.accumulated_depreciation
      );
    } else {
      row.additions = round2(row.additions + cost);
    }

    if (dispFy !== null && dispFy === fyEndYear) {
      row.deductions = round2(row.deductions + cost);
    } else {
      const currDep = getDepreciation(asset, fyEndYear);
      row.depreciation_for_year = round2(row.depreciation_for_year + currDep.depreciation_for_year);
      row.closing_accumulated_depreciation = round2(
        row.closing_accumulated_depreciation + currDep.accumulated_depreciation
      );
    }
  }

  const rows = [];
  for (const row of byTopCategory.values()) {
    row.closing_gross_block = round2(row.opening_gross_block + row.additions - row.deductions);
    row.net_block = round2(row.closing_gross_block - row.closing_accumulated_depreciation);
    row.fy = fyLabel;
    rows.push(row);
  }

  return rows;
}
