export { SMALL_VALUE_ASSET_LIMIT } from '../config/constants.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Given a Date or YYYY-MM-DD string, returns the ending calendar year of the
 * Indian financial year (1 April - 31 March).
 * Example: 2025-04-01 -> 2026 (FY 2025-26), 2026-03-31 -> 2026 (FY 2025-26).
 */
export function getFinancialYearEndYear(dateInput = new Date()) {
  let year;
  let month;
  if (typeof dateInput === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput.trim());
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
    } else {
      const d = new Date(dateInput);
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1;
    }
  } else {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }
  return month >= 4 ? year + 1 : year;
}

/**
 * Parses a financial year string like "2025-26" into its ending year (2026).
 */
export function parseFinancialYear(fy) {
  if (typeof fy === 'number' && Number.isInteger(fy)) return fy;
  if (typeof fy !== 'string') return getFinancialYearEndYear();
  const match = /^(\d{4})-(\d{2})$/.exec(fy.trim());
  if (match) {
    return Number(match[1]) + 1;
  }
  const yearOnly = /^(\d{4})$/.exec(fy.trim());
  if (yearOnly) {
    return Number(yearOnly[1]);
  }
  return getFinancialYearEndYear();
}

export function formatFinancialYear(fyEndYear) {
  const startYear = fyEndYear - 1;
  const endShort = String(fyEndYear).slice(-2);
  return `${startYear}-${endShort}`;
}

export function getEffectiveDepRate(category) {
  if (!category) return null;
  const rate = category.top_level_dep_rate_percent ?? category.dep_rate_percent;
  if (rate !== null && rate !== undefined && rate !== '') {
    return Number(rate);
  }
  const life = category.top_level_amortization_life_years ?? category.amortization_life_years;
  if (life !== null && life !== undefined && Number(life) > 0) {
    return Number((100.0 / Number(life)).toFixed(3));
  }
  if (category.effective_dep_rate_percent !== null && category.effective_dep_rate_percent !== undefined) {
    return Number(category.effective_dep_rate_percent);
  }
  return null;
}

/**
 * Pure SLM depreciation calculator for an asset in a given financial year (ending March 31 of fyEndYear).
 *
 * Rules:
 * - Financial year: 1 April to 31 March.
 * - Full-year charge in the year of capitalization regardless of month (no pro-rata).
 * - Residual value = 1 rupee (0 for Small Value Assets).
 * - Land (01) and Site Development (02): 0 depreciation, book value = cost.
 * - Disposed assets stop depreciating from the financial year of disposal.
 */
export function getDepreciation(asset, fyEndYear = getFinancialYearEndYear()) {
  const zero = {
    opening_book_value: 0,
    depreciation_for_year: 0,
    accumulated_depreciation: 0,
    closing_book_value: 0,
  };

  if (!asset || asset.cost === null || asset.cost === undefined || !asset.capitalization_date) {
    return zero;
  }

  const cost = Number(asset.cost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return zero;
  }

  const capFyEndYear = getFinancialYearEndYear(asset.capitalization_date);
  if (fyEndYear < capFyEndYear) {
    return zero;
  }

  const topCode =
    asset.top_level_category_code ??
    (typeof asset.category_code_path === 'string' ? asset.category_code_path.split('-')[0] : null);
  const topName = asset.top_level_category_name || '';

  const isZeroDepCategory =
    topCode === '01' ||
    topCode === '02' ||
    topName === 'Land' ||
    topName === 'Site Development';

  const effectiveRate = getEffectiveDepRate(asset);
  if (isZeroDepCategory || effectiveRate === 0 || effectiveRate === null) {
    const roundedCost = round2(cost);
    return {
      opening_book_value: roundedCost,
      depreciation_for_year: 0,
      accumulated_depreciation: 0,
      closing_book_value: roundedCost,
    };
  }

  const isSmallValue =
    topCode === '16' ||
    topName === 'Small Value Assets' ||
    effectiveRate === 100;

  const residual = isSmallValue ? 0 : Math.min(1, cost);

  const lifeYears =
    asset.top_level_amortization_life_years ?? asset.amortization_life_years ?? null;
  const rawRate = asset.top_level_dep_rate_percent ?? asset.dep_rate_percent ?? null;

  const annualDep =
    rawRate === null && lifeYears && Number(lifeYears) > 0
      ? cost / Number(lifeYears)
      : (cost * effectiveRate) / 100;

  const disposalDate = asset.disposed_on || asset.disposal_date || null;
  const disposalFyEndYear = disposalDate ? getFinancialYearEndYear(disposalDate) : null;

  let accDep = 0;
  let opening = round2(cost);
  let depForYear = 0;
  let closing = round2(cost);

  for (let y = capFyEndYear; y <= fyEndYear; y++) {
    opening = round2(cost - accDep);
    if (disposalFyEndYear !== null && y >= disposalFyEndYear) {
      depForYear = 0;
    } else {
      const maxAllowed = Math.max(0, round2(opening - residual));
      depForYear = Math.min(round2(annualDep), maxAllowed);
    }
    accDep = round2(accDep + depForYear);
    closing = round2(cost - accDep);
  }

  return {
    opening_book_value: opening,
    depreciation_for_year: depForYear,
    accumulated_depreciation: accDep,
    closing_book_value: closing,
  };
}
