import { DonationGoalCategory } from '@foodwaste/shared';

import { toFundedItems } from '../services/fund-ledger.service';

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
