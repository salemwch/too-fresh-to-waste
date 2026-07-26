/**
 * withAlpha.
 *
 * Derives tinted colours from tokens instead of hand-written rgba strings. It
 * runs inside StyleSheet definitions, so a malformed input must degrade to
 * something visible rather than to a transparent view the user cannot see.
 */

import { colorTokens, withAlpha } from '../colors';

describe('withAlpha', () => {
  describe('conversion', () => {
    it('converts six-digit hex', () => {
      expect(withAlpha('#FFFFFF', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('converts three-digit hex by expanding it', () => {
      expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('is case-insensitive', () => {
      expect(withAlpha('#aAbBcC', 1)).toBe(withAlpha('#AABBCC', 1));
    });

    it('converts a real token', () => {
      expect(withAlpha(colorTokens.base.neutral[1000], 0.45)).toBe('rgba(0, 0, 0, 0.45)');
    });

    it('handles mixed channel values', () => {
      expect(withAlpha('#1E4448', 0.3)).toBe('rgba(30, 68, 72, 0.3)');
    });
  });

  describe('alpha bounds', () => {
    it('keeps a fully opaque colour opaque', () => {
      expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    });

    it('supports fully transparent', () => {
      expect(withAlpha('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    });

    // A computed alpha (a progress ratio, an animation value) can overshoot.
    it.each([
      [1.5, 1],
      [42, 1],
      [-0.2, 0],
      [-99, 0],
    ])('clamps %p to %p', (given, expected) => {
      expect(withAlpha('#000000', given)).toBe(`rgba(0, 0, 0, ${expected})`);
    });
  });

  describe('inputs it cannot convert', () => {
    // Returning the input keeps a wrong colour visible on screen. Returning a
    // transparent fallback would hide the mistake and the element with it.
    it.each(['rgba(0, 0, 0, 0.5)', 'transparent', 'red', '', '#12', '#12345', 'not-a-colour'])(
      'returns %p unchanged',
      value => {
        expect(withAlpha(value, 0.5)).toBe(value);
      },
    );

    it('rejects an eight-digit hex rather than mis-parsing it', () => {
      // #RRGGBBAA already carries its own alpha; treating the last pair as blue
      // would silently produce the wrong colour.
      expect(withAlpha('#FFFFFF80', 0.5)).toBe('#FFFFFF80');
    });
  });

  it('produces a value React Native accepts', () => {
    expect(withAlpha('#1E4448', 0.12)).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/u);
  });
});
