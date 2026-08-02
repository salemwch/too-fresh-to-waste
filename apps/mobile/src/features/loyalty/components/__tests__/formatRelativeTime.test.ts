/**
 * formatRelativeTime — drives the "2h ago" labels in RecentActivityList.
 *
 * Five time buckets with boundaries that are easy to get wrong:
 *   < 1 min  → "Just now"
 *   < 1 hour → "Xm ago"
 *   < 1 day  → "Xh ago"
 *   < 1 week → "Xd ago"
 *   < 5 weeks → "Xw ago"
 *   else     → locale date
 */

import { formatRelativeTime } from '../RecentActivityList';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const NOW = new Date('2026-08-01T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -- "Just now" bucket ----------------------------------------------------

  it('returns "Just now" for a date 0 seconds ago', () => {
    expect(formatRelativeTime(ago(0))).toBe('Just now');
  });

  it('returns "Just now" for a date 30 seconds ago', () => {
    expect(formatRelativeTime(ago(30_000))).toBe('Just now');
  });

  it('returns "Just now" for a date 59 seconds ago', () => {
    expect(formatRelativeTime(ago(59_000))).toBe('Just now');
  });

  // -- minutes bucket -------------------------------------------------------

  it('switches to minutes at exactly 1 minute', () => {
    expect(formatRelativeTime(ago(MINUTE))).toBe('1m ago');
  });

  it('shows 59m for 59 minutes', () => {
    expect(formatRelativeTime(ago(59 * MINUTE))).toBe('59m ago');
  });

  // -- hours bucket ---------------------------------------------------------

  it('switches to hours at exactly 60 minutes', () => {
    expect(formatRelativeTime(ago(60 * MINUTE))).toBe('1h ago');
  });

  it('shows 23h for 23 hours', () => {
    expect(formatRelativeTime(ago(23 * HOUR))).toBe('23h ago');
  });

  // -- days bucket ----------------------------------------------------------

  it('switches to days at exactly 24 hours', () => {
    expect(formatRelativeTime(ago(24 * HOUR))).toBe('1d ago');
  });

  it('shows 6d for 6 days', () => {
    expect(formatRelativeTime(ago(6 * DAY))).toBe('6d ago');
  });

  // -- weeks bucket ---------------------------------------------------------

  it('switches to weeks at exactly 7 days', () => {
    expect(formatRelativeTime(ago(7 * DAY))).toBe('1w ago');
  });

  it('shows 4w for 4 weeks', () => {
    expect(formatRelativeTime(ago(4 * WEEK))).toBe('4w ago');
  });

  // -- locale date fallback -------------------------------------------------

  it('falls back to locale date at 5 weeks', () => {
    const result = formatRelativeTime(ago(5 * WEEK));
    expect(result).not.toContain('ago');
    expect(result).toMatch(/[A-Z][a-z]+ \d+/);
  });

  // -- malformed input ------------------------------------------------------

  it('returns empty string for a garbage date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatRelativeTime('')).toBe('');
  });

  // -- future dates ---------------------------------------------------------

  it('returns "Just now" for a date slightly in the future', () => {
    expect(formatRelativeTime(ago(-30_000))).toBe('Just now');
  });
});
