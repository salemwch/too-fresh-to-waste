/**
 * getRowTier — the rank cutoff between the phone prize and the discount.
 * Drives row styling and, downstream, which claim flow the user is offered.
 */

import { PHONE_PRIZE_MAX_RANK, getRowTier } from '../prizeTiers';

describe('getRowTier', () => {
  it('gives the phone tier to the top rank', () => {
    expect(getRowTier(1)).toBe('phone');
  });

  // The boundary, stated explicitly: rank 5 wins a phone, rank 6 does not.
  it('includes the cutoff rank in the phone tier', () => {
    expect(getRowTier(PHONE_PRIZE_MAX_RANK)).toBe('phone');
  });

  it('drops to the discount tier one past the cutoff', () => {
    expect(getRowTier(PHONE_PRIZE_MAX_RANK + 1)).toBe('discount');
  });

  it('gives the discount tier to a distant rank', () => {
    expect(getRowTier(500)).toBe('discount');
  });
});
