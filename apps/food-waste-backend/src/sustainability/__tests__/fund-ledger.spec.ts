import { DonationGoalCategory } from '@foodwaste/shared';

import { accumulateFundLedgerRows, toFundedItems } from '../services/fund-ledger.service';
import type { FundLedgerAggregationRow } from '../services/fund-ledger.service';

describe('toFundedItems', () => {
  it('converts TND per category using that category price', () => {
    // TSHIRTS 10 TND, MEDICINE 5 TND per DEFAULT_CATEGORY_PRICES
    const items = toFundedItems({
      [DonationGoalCategory.TSHIRTS]: 35,
      [DonationGoalCategory.MEDICINE]: 12,
    });

    expect(items).toEqual([
      { category: DonationGoalCategory.TSHIRTS, count: 3, amountTnd: 35 },
      { category: DonationGoalCategory.MEDICINE, count: 2, amountTnd: 12 },
    ]);
  });

  it('floors partial items and never rounds up', () => {
    // 9.99 TND does not buy a 10 TND t-shirt. Showing "1" would be the
    // inflation the spec forbids.
    const items = toFundedItems({ [DonationGoalCategory.TSHIRTS]: 9.99 });

    expect(items[0]).toEqual({
      category: DonationGoalCategory.TSHIRTS,
      count: 0,
      amountTnd: 9.99,
    });
  });

  it('returns an empty array for a merchant with no contributions', () => {
    expect(toFundedItems({})).toEqual([]);
  });

  it('ignores a category that is not in the price table', () => {
    // Defensive: a goal category added to the enum but not priced would
    // otherwise divide by undefined and emit NaN onto a public page.
    const items = toFundedItems({ NOT_A_GOAL: 50 } as Record<string, number>);

    expect(items).toEqual([]);
  });

  it('keeps categories in GOAL_SEQUENCE order, not insertion order', () => {
    const items = toFundedItems({
      [DonationGoalCategory.MEDICINE]: 25,
      [DonationGoalCategory.TSHIRTS]: 25,
    });

    expect(items.map(i => i.category)).toEqual([
      DonationGoalCategory.TSHIRTS,
      DonationGoalCategory.MEDICINE,
    ]);
  });

  it('handles the pre-backfill category being absent', () => {
    // Donations written before goalCategoryAtContribution existed group under
    // a null key. They contribute TND but no item breakdown.
    const items = toFundedItems({ null: 40 } as Record<string, number>);

    expect(items).toEqual([]);
  });
});

describe('accumulateFundLedgerRows', () => {
  function row(overrides: Partial<FundLedgerAggregationRow>): FundLedgerAggregationRow {
    return {
      _id: null,
      amount: 0,
      count: 0,
      first: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns zeros and a null firstContributionAt for an empty row set', () => {
    const result = accumulateFundLedgerRows([]);

    expect(result).toEqual({
      totalTnd: 0,
      currency: 'TND',
      contributionCount: 0,
      items: [],
      totalItems: 0,
      firstContributionAt: null,
    });
  });

  it('counts a null-category row toward totalTnd and contributionCount but emits no item', () => {
    // Task 4's backfill deliberately could not reconstruct
    // goalCategoryAtContribution for historical donations, so those group
    // under a null _id. The money must still be visible even though there is
    // no per-category breakdown for it.
    const rows: FundLedgerAggregationRow[] = [
      row({ _id: null, amount: 40, count: 3, first: new Date('2026-01-01T00:00:00.000Z') }),
      row({
        _id: DonationGoalCategory.TSHIRTS,
        amount: 20,
        count: 1,
        first: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ];

    const result = accumulateFundLedgerRows(rows);

    expect(result.totalTnd).toBe(60);
    expect(result.contributionCount).toBe(4);
    expect(result.items).toEqual([
      { category: DonationGoalCategory.TSHIRTS, count: 2, amountTnd: 20 },
    ]);
  });

  it('gives a merchant whose rows are ALL null-category a correct non-zero total', () => {
    // Regression case: summing only rows that produce an item would leave
    // totalTnd at 0 for a merchant whose entire history predates the
    // goalCategoryAtContribution backfill.
    const rows: FundLedgerAggregationRow[] = [
      row({ _id: null, amount: 15, count: 1, first: new Date('2026-01-05T00:00:00.000Z') }),
      row({ _id: null, amount: 25, count: 2, first: new Date('2026-01-03T00:00:00.000Z') }),
    ];

    const result = accumulateFundLedgerRows(rows);

    expect(result.totalTnd).toBe(40);
    expect(result.contributionCount).toBe(3);
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  it('takes the earliest contributedAt across rows, not the first row encountered', () => {
    const rows: FundLedgerAggregationRow[] = [
      row({
        _id: DonationGoalCategory.MEDICINE,
        amount: 10,
        count: 1,
        first: new Date('2026-03-15T00:00:00.000Z'),
      }),
      row({
        _id: DonationGoalCategory.TSHIRTS,
        amount: 10,
        count: 1,
        first: new Date('2026-01-10T00:00:00.000Z'),
      }),
      row({
        _id: null,
        amount: 5,
        count: 1,
        first: new Date('2026-02-20T00:00:00.000Z'),
      }),
    ];

    const result = accumulateFundLedgerRows(rows);

    expect(result.firstContributionAt).toBe(new Date('2026-01-10T00:00:00.000Z').toISOString());
  });

  it('sets totalItems to the sum of the item counts, not the raw contribution count', () => {
    const rows: FundLedgerAggregationRow[] = [
      row({ _id: DonationGoalCategory.TSHIRTS, amount: 35, count: 5, first: new Date() }),
      row({ _id: DonationGoalCategory.MEDICINE, amount: 12, count: 7, first: new Date() }),
    ];

    const result = accumulateFundLedgerRows(rows);

    // 35 TND / 10 = 3 t-shirts, 12 TND / 5 = 2 medicine kits -> 5 items,
    // even though the raw contribution count (rows' `count`) sums to 12.
    expect(result.totalItems).toBe(5);
    expect(result.contributionCount).toBe(12);
  });
});
