/**
 * getCountdown — drives the challenge timer, ticking once a second.
 *
 * Extracted from LeaderboardScreen, which had no tests. The unit boundaries are
 * the part worth pinning: each field is the remainder within the next unit up,
 * not a running total.
 */

import { getCountdown } from '../countdown';

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const NOW = new Date('2026-07-26T12:00:00.000Z').getTime();

const inMs = (ms: number) => new Date(NOW + ms).toISOString();

describe('getCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('no countdown to show', () => {
    it('returns null without an end date', () => {
      expect(getCountdown(undefined)).toBeNull();
    });

    it('returns null once the challenge has ended', () => {
      expect(getCountdown(inMs(-SECOND))).toBeNull();
    });

    // Exactly at the deadline counts as over, not as zero.
    it('returns null at the exact end instant', () => {
      expect(getCountdown(inMs(0))).toBeNull();
    });

    it('returns null for an unparseable date rather than NaN fields', () => {
      expect(getCountdown('not-a-date')).toBeNull();
    });
  });

  describe('unit split', () => {
    it('reports whole days', () => {
      expect(getCountdown(inMs(3 * DAY))).toEqual({ days: 3, hours: 0, mins: 0, secs: 0 });
    });

    // Each field is the remainder within the next unit up: 26 hours is
    // 1 day + 2 hours, never 26 hours.
    it('rolls hours into days', () => {
      expect(getCountdown(inMs(26 * HOUR))).toEqual({ days: 1, hours: 2, mins: 0, secs: 0 });
    });

    it('rolls minutes into hours', () => {
      expect(getCountdown(inMs(90 * MINUTE))).toEqual({ days: 0, hours: 1, mins: 30, secs: 0 });
    });

    it('rolls seconds into minutes', () => {
      expect(getCountdown(inMs(90 * SECOND))).toEqual({ days: 0, hours: 0, mins: 1, secs: 30 });
    });

    it('combines all four units', () => {
      const ms = 2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND;

      expect(getCountdown(inMs(ms))).toEqual({ days: 2, hours: 3, mins: 4, secs: 5 });
    });
  });

  describe('boundaries', () => {
    it('shows the final second rather than nothing', () => {
      expect(getCountdown(inMs(SECOND))).toEqual({ days: 0, hours: 0, mins: 0, secs: 1 });
    });

    // Sub-second remainders floor to zero across the board, but the challenge
    // is still running — the caller must not treat this as ended.
    it('returns zeros, not null, in the last fraction of a second', () => {
      expect(getCountdown(inMs(500))).toEqual({ days: 0, hours: 0, mins: 0, secs: 0 });
    });

    it('handles a long challenge', () => {
      expect(getCountdown(inMs(180 * DAY))?.days).toBe(180);
    });
  });
});
