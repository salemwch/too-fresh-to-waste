/**
 * OfferCard pure helpers — formatPickupTime, formatDistance, formatStartTime.
 *
 * These render on every offer card in the app. A formatting bug shows wrong
 * pickup times or distances to every user on every screen.
 */

import { formatPickupTime, formatDistance, formatStartTime } from '../OfferCard.types';

// ---------------------------------------------------------------------------
// formatPickupTime
// ---------------------------------------------------------------------------

describe('formatPickupTime', () => {
  it('returns the first time slot range when slots exist', () => {
    const slots = [
      { startTime: '14:00', endTime: '16:00' },
      { startTime: '18:00', endTime: '20:00' },
    ];
    expect(formatPickupTime(slots)).toBe('14:00 - 16:00');
  });

  it('ignores later slots — only the first matters', () => {
    const slots = [
      { startTime: '09:30', endTime: '11:00' },
      { startTime: '15:00', endTime: '17:00' },
    ];
    expect(formatPickupTime(slots)).toBe('09:30 - 11:00');
  });

  it('falls back to availableUntil when no time slots', () => {
    const result = formatPickupTime(undefined, '2026-08-01T14:30:00.000Z');
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('falls back to availableUntil when slots array is empty', () => {
    const result = formatPickupTime([], '2026-08-01T14:30:00.000Z');
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('returns null when neither slots nor availableUntil provided', () => {
    expect(formatPickupTime(undefined, undefined)).toBeNull();
  });

  it('returns null for a garbage availableUntil string', () => {
    expect(formatPickupTime(undefined, 'not-a-date')).toBeNull();
  });

  it('prefers time slots over availableUntil', () => {
    const slots = [{ startTime: '10:00', endTime: '12:00' }];
    expect(formatPickupTime(slots, '2026-08-01T20:00:00.000Z')).toBe('10:00 - 12:00');
  });
});

// ---------------------------------------------------------------------------
// formatDistance
// ---------------------------------------------------------------------------

describe('formatDistance', () => {
  it('returns null for undefined', () => {
    expect(formatDistance(undefined)).toBeNull();
  });

  it('returns null for null (runtime safety)', () => {
    expect(formatDistance(null as unknown as undefined)).toBeNull();
  });

  it('formats zero meters', () => {
    expect(formatDistance(0)).toBe('0m');
  });

  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(450)).toBe('450m');
  });

  it('rounds meters to nearest integer', () => {
    expect(formatDistance(123.7)).toBe('124m');
  });

  it('formats exactly 1000m as km', () => {
    expect(formatDistance(1000)).toBe('1.0km');
  });

  it('formats distances above 1km with one decimal', () => {
    expect(formatDistance(2500)).toBe('2.5km');
  });

  it('formats 999m as meters, not km', () => {
    expect(formatDistance(999)).toBe('999m');
  });

  it('boundary: 999.5 rounds to 1000m which is still < 1000', () => {
    expect(formatDistance(999.5)).toBe('1000m');
  });
});

// ---------------------------------------------------------------------------
// formatStartTime
// ---------------------------------------------------------------------------

describe('formatStartTime', () => {
  it('formats a valid ISO timestamp to HH:MM in Africa/Tunis', () => {
    const result = formatStartTime('2026-08-01T13:00:00.000Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns null for a garbage string', () => {
    expect(formatStartTime('nope')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatStartTime('')).toBeNull();
  });
});
