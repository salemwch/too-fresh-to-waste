/**
 * getRowTier — the rank cutoff between the phone prize and the discount.
 * Drives row styling and, downstream, which claim flow the user is offered.
 */

import { DISCOUNT_PRIZE_MIN_RANK, PHONE_PRIZE_MAX_RANK, getRowTier } from '../prizeTiers';

describe('getRowTier', () => {
  it('gives the phone tier to the top rank', () => {
    expect(getRowTier(1)).toBe('phone');
  });

  // The boundary, stated explicitly: rank 3 wins a phone, rank 4 does not.
  it('includes the cutoff rank in the phone tier', () => {
    expect(getRowTier(PHONE_PRIZE_MAX_RANK)).toBe('phone');
  });

  it('drops to the discount tier one past the cutoff', () => {
    expect(getRowTier(PHONE_PRIZE_MAX_RANK + 1)).toBe('discount');
  });

  it('gives the discount tier to a distant rank', () => {
    expect(getRowTier(500)).toBe('discount');
  });

  /*
   * The smartphone is unlocked by the community bag goal, not by rank alone.
   * A season that fell short pays everyone a discount — so the top ranks must
   * stop being shown a phone they cannot win.
   */
  describe('when the community goal was missed', () => {
    it.each([1, 2, PHONE_PRIZE_MAX_RANK])('drops rank %i to the discount tier', rank => {
      expect(getRowTier(rank, false)).toBe('discount');
    });

    it('leaves the ranks that already won a discount unchanged', () => {
      expect(getRowTier(DISCOUNT_PRIZE_MIN_RANK, false)).toBe('discount');
    });
  });

  // Before the season ends there is no result yet, and the top ranks should
  // see the prize they are playing for.
  it('assumes the goal will be met when not told otherwise', () => {
    expect(getRowTier(1)).toBe(getRowTier(1, true));
  });
});

describe('prize rank constants', () => {
  it('starts the discount tier immediately after the phone tier', () => {
    expect(DISCOUNT_PRIZE_MIN_RANK).toBe(PHONE_PRIZE_MAX_RANK + 1);
  });

  // Must match PHONE_MAX_RANK in the backend's prize-claim.service.ts. If these
  // drift the app promises a prize the server will refuse to award.
  it('awards the phone to three ranks', () => {
    expect(PHONE_PRIZE_MAX_RANK).toBe(3);
  });
});
