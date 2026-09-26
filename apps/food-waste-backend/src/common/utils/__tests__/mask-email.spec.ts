import { maskEmail } from '../mask-email';

describe('maskEmail', () => {
  it.each([
    ['salem@gmail.com', 's***@gmail.com'],
    ['  Salem@GMAIL.com ', 'S***@gmail.com'],
    ['a@b.tn', 'a***@b.tn'],
    // The last @ splits: a quoted local part may contain one.
    ['"we@ird"@example.org', '"***@example.org'],
  ])('keeps only the first character and the domain: %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['no-at-sign', 'no @'],
    ['@example.org', 'no local part'],
    ['user@', 'no domain'],
    [undefined, 'undefined'],
    [null, 'null'],
    [42, 'a number'],
  ])('logs a malformed value as *** (%s: %s)', (input, _label) => {
    expect(maskEmail(input)).toBe('***');
  });

  it('never contains the local part beyond its first character', () => {
    expect(maskEmail('secret.person@example.org')).not.toContain('ecret');
  });
});
