import { getTierConfig, getTierProgress, getPointsToNextTier, normalizeTier } from '../tiers';

import type { TierName } from '../../types/loyalty.types';

/**
 * A tier value that is typed as TierName but is not one at runtime - exactly
 * what the API produced on device ('silver' instead of 'Silver'), and what
 * threw "Cannot read property 'minPoints' of undefined" on the Loyalty screen.
 */
const UNKNOWN = 'silver' as TierName;

const ALL_TIERS: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

describe('normalizeTier', () => {
  it.each(ALL_TIERS)('leaves the known tier %s untouched', tier => {
    expect(normalizeTier(tier)).toBe(tier);
  });

  it.each(['silver', 'BRONZE', 'Diamond', '', 'toString'])(
    'coerces the unrecognised value %p to Bronze',
    value => {
      expect(normalizeTier(value as TierName)).toBe('Bronze');
    },
  );
});

describe('getTierConfig', () => {
  it.each(ALL_TIERS)('returns the matching config for %s', tier => {
    expect(getTierConfig(tier).name).toBe(tier);
  });

  it('falls back to Bronze for an unrecognised tier instead of returning undefined', () => {
    expect(getTierConfig(UNKNOWN).name).toBe('Bronze');
  });
});

describe('getTierProgress', () => {
  it.each(ALL_TIERS)('returns a finite 0..1 value for %s', tier => {
    const progress = getTierProgress(tier, 250);
    expect(Number.isFinite(progress)).toBe(true);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('does not throw on an unrecognised tier', () => {
    expect(() => getTierProgress(UNKNOWN, 250)).not.toThrow();
  });

  it('treats an unrecognised tier exactly as Bronze, not as progress toward Bronze', () => {
    // The old code produced indexOf === -1, cleared the top-tier guard, and
    // then indexed orderedTiers[0] - reporting progress toward Bronze from
    // Bronze. Asserting equality with Bronze pins the intended behaviour
    // rather than merely "does not throw".
    expect(getTierProgress(UNKNOWN, 250)).toBe(getTierProgress('Bronze', 250));
  });

  it('returns 1 at the top tier', () => {
    expect(getTierProgress('Platinum', 0)).toBe(1);
    expect(getTierProgress('Platinum', 999999)).toBe(1);
  });

  it('clamps below the tier floor and above the next tier', () => {
    expect(getTierProgress('Bronze', -100)).toBe(0);
    expect(getTierProgress('Bronze', 999999)).toBe(1);
  });

  it('is monotonic in points within a tier', () => {
    const low = getTierProgress('Bronze', 10);
    const high = getTierProgress('Bronze', 200);
    expect(high).toBeGreaterThanOrEqual(low);
    // Non-vacuous: the two must not both be a clamped constant.
    expect(high).toBeGreaterThan(low);
  });
});

describe('getPointsToNextTier', () => {
  it.each(ALL_TIERS)('returns a finite non-negative number for %s', tier => {
    const remaining = getPointsToNextTier(tier, 250);
    expect(Number.isFinite(remaining)).toBe(true);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('does not throw on an unrecognised tier', () => {
    expect(() => getPointsToNextTier(UNKNOWN, 250)).not.toThrow();
  });

  it('treats an unrecognised tier exactly as Bronze', () => {
    expect(getPointsToNextTier(UNKNOWN, 250)).toBe(getPointsToNextTier('Bronze', 250));
  });

  it('returns 0 at the top tier', () => {
    expect(getPointsToNextTier('Platinum', 0)).toBe(0);
  });

  it('never returns a negative remainder once the next tier is passed', () => {
    expect(getPointsToNextTier('Bronze', 999999)).toBe(0);
  });
});
