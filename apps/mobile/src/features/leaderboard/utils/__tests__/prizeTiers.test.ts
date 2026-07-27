/**
 * getRowTier — the cutoff between the grand prize and the discount.
 *
 * The cutoff is a *parameter*, not a constant. How many top ranks win is
 * `VotingCycle.recipientCount`, set by the admin per season. It used to be
 * hardcoded here at 3 while the voting path awarded 5, so ranks 4 and 5 were
 * told they had won by one screen and refused by the other.
 */

import { DEFAULT_PRIZE_RANKS, firstDiscountRank, getRowTier } from '../prizeTiers';

describe('getRowTier', () => {
  describe('with the season cutoff supplied', () => {
    it('gives the grand prize to the top rank', () => {
      expect(getRowTier(1, 3)).toBe('grandPrize');
    });

    // The boundary, both sides.
    it.each([
      [3, 3, 'grandPrize'],
      [4, 3, 'discount'],
      [5, 5, 'grandPrize'],
      [6, 5, 'discount'],
    ])('rank %i with a cutoff of %i is %s', (rank, cutoff, expected) => {
      expect(getRowTier(rank, cutoff)).toBe(expected);
    });

    /*
     * The case the whole parameter exists for: an admin running a 5-winner
     * season. Hardcoding 3 told rank 4 they had lost while the server paid them.
     */
    it('honours a 5-winner season', () => {
      expect(getRowTier(4, 5)).toBe('grandPrize');
      expect(getRowTier(5, 5)).toBe('grandPrize');
    });

    it('gives the discount to a distant rank', () => {
      expect(getRowTier(500, 3)).toBe('discount');
    });

    // An admin could set 0 — nobody wins the grand prize that season.
    it('awards nothing when the cutoff is zero', () => {
      expect(getRowTier(1, 0)).toBe('discount');
    });
  });

  /*
   * The grand prize is unlocked by the community bag goal, not by rank alone.
   * A season that fell short pays everyone a discount — so the top ranks must
   * stop being shown a prize they cannot win.
   */
  describe('when the community goal was missed', () => {
    it.each([1, 2, 3])('drops rank %i to the discount tier', rank => {
      expect(getRowTier(rank, 3, false)).toBe('discount');
    });

    it('leaves the ranks that already won a discount unchanged', () => {
      expect(getRowTier(4, 3, false)).toBe('discount');
    });
  });

  describe('before the season data has loaded', () => {
    // The cutoff arrives with the claim status; the first paint has neither.
    it('falls back to the default cutoff', () => {
      expect(getRowTier(DEFAULT_PRIZE_RANKS)).toBe('grandPrize');
      expect(getRowTier(DEFAULT_PRIZE_RANKS + 1)).toBe('discount');
    });

    // No result yet, so show the prize they are playing for.
    it('assumes the goal will be met when not told otherwise', () => {
      expect(getRowTier(1, 3)).toBe(getRowTier(1, 3, true));
    });
  });
});

describe('firstDiscountRank', () => {
  it('starts immediately after the grand-prize tier', () => {
    expect(firstDiscountRank(3)).toBe(4);
    expect(firstDiscountRank(5)).toBe(6);
  });

  it('falls back to the default cutoff', () => {
    expect(firstDiscountRank()).toBe(DEFAULT_PRIZE_RANKS + 1);
  });
});
