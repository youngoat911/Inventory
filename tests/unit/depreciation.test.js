import { describe, it, expect } from 'vitest';
import {
  getDepreciation,
  getFinancialYearEndYear,
  getEffectiveDepRate,
  SMALL_VALUE_ASSET_LIMIT,
} from '../../src/shared/depreciation.js';

describe('Depreciation Calculation Unit Tests', () => {
  it('exports SMALL_VALUE_ASSET_LIMIT = 2000', () => {
    expect(SMALL_VALUE_ASSET_LIMIT).toBe(2000);
  });

  it('computes Computers 20% over 5 years ending at 1 rupee residual', () => {
    const computer = {
      cost: 100000,
      capitalization_date: '2021-04-01', // FY 2021-22 -> fyEndYear 2022
      top_level_category_code: '12',
      top_level_dep_rate_percent: 20,
    };

    expect(getDepreciation(computer, 2022)).toEqual({
      opening_book_value: 100000,
      depreciation_for_year: 20000,
      accumulated_depreciation: 20000,
      closing_book_value: 80000,
    });

    // Year 5 (FY 2025-26 -> fyEndYear 2026) stops at 1 rupee residual
    expect(getDepreciation(computer, 2026)).toEqual({
      opening_book_value: 20000,
      depreciation_for_year: 19999,
      accumulated_depreciation: 99999,
      closing_book_value: 1,
    });

    // Year 6: no further depreciation
    expect(getDepreciation(computer, 2027)).toEqual({
      opening_book_value: 1,
      depreciation_for_year: 0,
      accumulated_depreciation: 99999,
      closing_book_value: 1,
    });
  });

  it('computes Patents over 9-year amortization life ending at 1 rupee residual', () => {
    const patent = {
      cost: 90000,
      capitalization_date: '2020-06-15', // FY 2020-21 -> fyEndYear 2021
      top_level_category_code: '19',
      top_level_dep_rate_percent: null,
      top_level_amortization_life_years: 9,
    };

    expect(getEffectiveDepRate(patent)).toBe(11.111);

    expect(getDepreciation(patent, 2021)).toEqual({
      opening_book_value: 90000,
      depreciation_for_year: 10000,
      accumulated_depreciation: 10000,
      closing_book_value: 80000,
    });

    // 9th year (2029): ends at 1 rupee residual
    expect(getDepreciation(patent, 2029)).toEqual({
      opening_book_value: 10000,
      depreciation_for_year: 9999,
      accumulated_depreciation: 89999,
      closing_book_value: 1,
    });
  });

  it('charges a full year for an asset capitalized on 31 March (no pro-rata)', () => {
    expect(getFinancialYearEndYear('2026-03-31')).toBe(2026);
    expect(getFinancialYearEndYear('2025-04-01')).toBe(2026);

    const march31Asset = {
      cost: 50000,
      capitalization_date: '2026-03-31', // FY 2025-26 -> fyEndYear 2026
      top_level_category_code: '14', // Vehicles 10%
      top_level_dep_rate_percent: 10,
    };

    expect(getDepreciation(march31Asset, 2026)).toEqual({
      opening_book_value: 50000,
      depreciation_for_year: 5000,
      accumulated_depreciation: 5000,
      closing_book_value: 45000,
    });
  });

  it('keeps Land and Site Development at cost with 0 depreciation', () => {
    const land = {
      cost: 5000000,
      capitalization_date: '2015-05-01',
      top_level_category_code: '01',
      top_level_dep_rate_percent: 0,
    };
    expect(getDepreciation(land, 2026)).toEqual({
      opening_book_value: 5000000,
      depreciation_for_year: 0,
      accumulated_depreciation: 0,
      closing_book_value: 5000000,
    });
  });

  it('depreciates Small Value Assets 100% in year of acquisition with 0 residual', () => {
    const sva = {
      cost: 1500,
      capitalization_date: '2025-11-10',
      top_level_category_code: '16',
      top_level_dep_rate_percent: 100,
    };
    expect(getDepreciation(sva, 2026)).toEqual({
      opening_book_value: 1500,
      depreciation_for_year: 1500,
      accumulated_depreciation: 1500,
      closing_book_value: 0,
    });
  });

  it('stops depreciating disposed assets from the year of disposal', () => {
    const disposed = {
      cost: 100000,
      capitalization_date: '2023-05-01', // FY 2023-24 -> 2024
      disposed_on: '2025-08-15',         // FY 2025-26 -> 2026
      top_level_category_code: '12',
      top_level_dep_rate_percent: 20,
    };

    // FY 2024-25 (2025): still active, 2nd year of 20%
    expect(getDepreciation(disposed, 2025)).toEqual({
      opening_book_value: 80000,
      depreciation_for_year: 20000,
      accumulated_depreciation: 40000,
      closing_book_value: 60000,
    });

    // FY 2025-26 (2026): disposed, 0 depreciation in year of disposal
    expect(getDepreciation(disposed, 2026)).toEqual({
      opening_book_value: 60000,
      depreciation_for_year: 0,
      accumulated_depreciation: 40000,
      closing_book_value: 60000,
    });
  });
});
