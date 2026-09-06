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

  it('ignores a key that is not a goal category at all', () => {
    // What this actually exercises: the `amountTnd === undefined` early
    // return. `toFundedItems` iterates GOAL_SEQUENCE, so a key outside that
    // sequence is never read and simply drops out.
    //
    // It does NOT reach the `!price || price <= 0` guard below it. That guard
    // is unreachable by construction: DEFAULT_CATEGORY_PRICES is typed
    // Record<DonationGoalCategory, ...> with all five categories priced
    // positive, so every key GOAL_SEQUENCE yields has a price. The guard stays
    // as a compile-time-unenforceable safety net for a future category added
    // to the enum and the sequence but not to the price table; nothing here
    // covers it.
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

  it('emits no item for the pre-backfill null category key', () => {
    // Donations written before goalCategoryAtContribution existed group under
    // a null _id, which stringifies to the key "null". They contribute TND
    // (accumulateFundLedgerRows adds them to totalTnd) but no item breakdown.
    //
    // Same path as the test above: "null" is not in GOAL_SEQUENCE, so this
    // exercises the `amountTnd === undefined` early return, not the
    // `!price || price <= 0` guard. Kept as a separate case because the cause
    // is different - a real production data shape rather than a bad key - and
    // a regression that started emitting an item for it would be a visible
    // bug on the card.
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

  it('keeps an earlier date when a later row carries a null first', () => {
    // `$min` returns null for a group whose documents all lack contributedAt,
    // so `first` is genuinely nullable however the schema declares it. The
    // null row is deliberately second: dropping the `row.first &&` guard makes
    // `null < <a Date>` coerce to `0 < <ms>` = true, which overwrites the real
    // earliest date with null and the card silently loses its "since" line.
    const rows: FundLedgerAggregationRow[] = [
      row({
        _id: DonationGoalCategory.TSHIRTS,
        amount: 20,
        count: 1,
        first: new Date('2026-02-01T00:00:00.000Z'),
      }),
      row({ _id: null, amount: 5, count: 1, first: null }),
    ];

    const result = accumulateFundLedgerRows(rows);

    expect(result.firstContributionAt).toBe(new Date('2026-02-01T00:00:00.000Z').toISOString());
    // The null-first row's money is still counted - only its date is skipped.
    expect(result.totalTnd).toBe(25);
    expect(result.contributionCount).toBe(2);
  });

  it('reports a null firstContributionAt when every row has a null first', () => {
    const rows: FundLedgerAggregationRow[] = [
      row({ _id: null, amount: 5, count: 1, first: null }),
      row({ _id: DonationGoalCategory.MEDICINE, amount: 10, count: 1, first: null }),
    ];

    const result = accumulateFundLedgerRows(rows);

    expect(result.firstContributionAt).toBeNull();
    expect(result.totalTnd).toBe(15);
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
