import {
  SUBSCRIPTION_DURATION_MS,
  nextSubscriptionExpiry,
  toSubscriptionCycle,
} from '../subscription-period';

/**
 * A paid subscription with no end date is invisible to the nightly scan —
 * `{ subscriptionExpiresAt: { $lt: now } }` never matches a missing field — so it
 * runs forever. Every paid establishment in production was in that state,
 * because the admin `markAsPaid` path set the status and no period.
 *
 * This module is what both grant paths now go through. What it must never do is
 * return something that is not a usable future date.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-31T09:00:00.000Z');

describe('SUBSCRIPTION_DURATION_MS', () => {
  it('bills a month as 30 days and a year as 365', () => {
    expect(SUBSCRIPTION_DURATION_MS.monthly).toBe(30 * DAY);
    expect(SUBSCRIPTION_DURATION_MS.yearly).toBe(365 * DAY);
  });

  it('makes a year longer than twelve months of access', () => {
    // Yearly is priced as twelve monthly payments, so it must not deliver less
    // time than paying monthly twelve times would.
    expect(SUBSCRIPTION_DURATION_MS.yearly).toBeGreaterThan(12 * SUBSCRIPTION_DURATION_MS.monthly);
  });
});

describe('nextSubscriptionExpiry', () => {
  describe('a lapsed or first-time subscription starts from now', () => {
    it('grants 30 days on a monthly cycle', () => {
      expect(nextSubscriptionExpiry('monthly', undefined, NOW)).toEqual(
        new Date(NOW.getTime() + 30 * DAY),
      );
    });

    it('grants 365 days on a yearly cycle', () => {
      expect(nextSubscriptionExpiry('yearly', undefined, NOW)).toEqual(
        new Date(NOW.getTime() + 365 * DAY),
      );
    });

    it('does not resurrect an expiry that has already passed', () => {
      // A merchant returning after six months buys a fresh period, not one that
      // was spent while they were away.
      const longGone = new Date(NOW.getTime() - 180 * DAY);
      expect(nextSubscriptionExpiry('monthly', longGone, NOW)).toEqual(
        new Date(NOW.getTime() + 30 * DAY),
      );
    });

    it('treats an expiry landing exactly now as spent', () => {
      expect(nextSubscriptionExpiry('monthly', NOW, NOW)).toEqual(
        new Date(NOW.getTime() + 30 * DAY),
      );
    });
  });

  describe('renewing early extends rather than resets', () => {
    it('adds the period to the existing end date', () => {
      // Paying a week ahead must not donate that week back to us.
      const inSevenDays = new Date(NOW.getTime() + 7 * DAY);
      expect(nextSubscriptionExpiry('monthly', inSevenDays, NOW)).toEqual(
        new Date(inSevenDays.getTime() + 30 * DAY),
      );
    });

    it('never returns less time than starting from now would', () => {
      for (const offsetDays of [-30, -1, 0, 1, 30, 400]) {
        const current = new Date(NOW.getTime() + offsetDays * DAY);
        const result = nextSubscriptionExpiry('monthly', current, NOW);
        expect(result.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 30 * DAY);
      }
    });
  });

  describe('unusable stored values fall back to now', () => {
    // These are exactly the shapes the backfill migration reads, so the function
    // has to survive them rather than propagate NaN into a stored date.

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('handles %s', (_label, value) => {
      expect(nextSubscriptionExpiry('monthly', value, NOW)).toEqual(
        new Date(NOW.getTime() + 30 * DAY),
      );
    });

    it('handles an Invalid Date without producing one', () => {
      const result = nextSubscriptionExpiry('monthly', new Date('nonsense'), NOW);
      expect(Number.isNaN(result.getTime())).toBe(false);
      expect(result).toEqual(new Date(NOW.getTime() + 30 * DAY));
    });
  });

  it('always returns a date in the future', () => {
    // The property that matters: whatever is stored, the merchant ends up with
    // time on the clock. A past date would be suspended on the next nightly scan.
    const candidates = [undefined, null, new Date('nonsense'), new Date(0), NOW];
    for (const cycle of ['monthly', 'yearly'] as const) {
      for (const current of candidates) {
        expect(nextSubscriptionExpiry(cycle, current, NOW).getTime()).toBeGreaterThan(
          NOW.getTime(),
        );
      }
    }
  });

  it('does not mutate the date it was given', () => {
    const current = new Date(NOW.getTime() + 7 * DAY);
    const before = current.getTime();
    nextSubscriptionExpiry('yearly', current, NOW);
    expect(current.getTime()).toBe(before);
  });
});

describe('toSubscriptionCycle', () => {
  it('passes through the two real cycles', () => {
    expect(toSubscriptionCycle('monthly')).toBe('monthly');
    expect(toSubscriptionCycle('yearly')).toBe('yearly');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a tier name', 'pro'],
    ['empty string', ''],
    ['a number', 12],
    ['wrong case', 'YEARLY'],
  ])('defaults %s to monthly', (_label, value) => {
    // Monthly is the shorter grant: a bad value must not hand out a free year.
    // 'pro' is not hypothetical — a production document had it stored in
    // pendingCycle, where a tier had been written into a cycle field.
    expect(toSubscriptionCycle(value)).toBe('monthly');
  });
});
