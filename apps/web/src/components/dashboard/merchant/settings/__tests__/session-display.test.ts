import { describeDevice, formatSessionDate } from '../session-display';
import { formatDate } from '@/lib/format';

import type { SessionDeviceInfo } from '@/types/settings';

/**
 * Opening the merchant Settings → Sessions tab crashed the page.
 *
 * `ActiveSession` was a hand-written mirror of `GET /auth/sessions` and was
 * wrong in four places at once: `lastActive` vs `lastActivityAt`, `isCurrent` vs
 * `isCurrentSession`, a string `deviceInfo` vs an object, and a top-level
 * `ipAddress` that lives inside that object. The card read the field that did
 * not exist and called `new Date(undefined).toLocaleDateString()`, which throws
 * `RangeError: Invalid time value` rather than returning a placeholder — so one
 * absent field took down the whole route.
 *
 * These two helpers are what the card goes through now. Neither may throw, and
 * neither may render "Invalid Date" or "undefined" at a merchant.
 */

/** A fixed locale keeps these assertions deterministic across machines. */
const LOCALE = 'en';

describe('formatSessionDate', () => {
  it('formats a real timestamp', () => {
    expect(formatSessionDate(LOCALE, '2026-07-31T09:00:00.000Z')).toBe(
      formatDate(LOCALE, '2026-07-31T09:00:00.000Z'),
    );
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
  ])('returns null for %s rather than throwing', (_label, value) => {
    expect(() => formatSessionDate(LOCALE, value)).not.toThrow();
    expect(formatSessionDate(LOCALE, value)).toBeNull();
  });

  it('returns null for an unparseable value instead of "Invalid Date"', () => {
    // This is the exact failure: Date rejects it, and every downstream method
    // on the result throws.
    expect(formatSessionDate(LOCALE, 'not a date')).toBeNull();
  });

  it('never returns a string containing "Invalid"', () => {
    for (const input of [undefined, '', 'nonsense', '2026-13-45', '0000-00-00']) {
      const result = formatSessionDate(LOCALE, input);
      expect(result === null || !result.includes('Invalid')).toBe(true);
    }
  });
});

describe('describeDevice', () => {
  it('joins the parts the session carries', () => {
    const device: SessionDeviceInfo = { platform: 'Windows', browser: 'Chrome' };
    expect(describeDevice(device)).toBe('Windows · Chrome');
  });

  it('includes a device name when there is one', () => {
    const device: SessionDeviceInfo = {
      deviceName: 'Salem MacBook',
      platform: 'macOS',
      browser: 'Safari',
    };
    expect(describeDevice(device)).toBe('Salem MacBook · macOS · Safari');
  });

  it('does not repeat a value that appears twice', () => {
    // Some clients report the same string as both name and platform; printing
    // "Android · Android" looks like a bug to the person reading it.
    const device: SessionDeviceInfo = { deviceName: 'Android', platform: 'Android' };
    expect(describeDevice(device)).toBe('Android');
  });

  it('drops blank and whitespace-only parts', () => {
    const device: SessionDeviceInfo = { deviceName: '', platform: '   ', browser: 'Firefox' };
    expect(describeDevice(device)).toBe('Firefox');
  });

  it.each([
    ['undefined', undefined],
    ['an empty object', {}],
    ['all-blank fields', { deviceName: '', platform: '', browser: '' }],
  ])('returns null for %s so the caller can show its own label', (_label, device) => {
    // null, not '' — the card prints a translated "Unknown device", which an
    // empty string would silently replace with a blank line.
    expect(describeDevice(device as SessionDeviceInfo | undefined)).toBeNull();
  });

  it('ignores fields that are not strings', () => {
    // The API is not validated at this boundary; a number here must not become
    // "42" in the UI.
    const device = { deviceName: 42, platform: 'Linux' } as unknown as SessionDeviceInfo;
    expect(describeDevice(device)).toBe('Linux');
  });
});
