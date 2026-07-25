/**
 * RTL helpers must behave correctly in BOTH directions.
 *
 * Arabic is a supported locale, so a regression here silently misaligns the
 * entire Arabic UI — the exact class of bug these helpers exist to prevent.
 */

import { I18nManager } from 'react-native';

import { textAlignStart, textAlignEnd, mirrorGlyph } from '../rtl';

describe('rtl helpers', () => {
  const setRTL = (value: boolean) => {
    // I18nManager.isRTL is a read-only native constant; override it per-test.
    Object.defineProperty(I18nManager, 'isRTL', { value, configurable: true });
  };

  afterEach(() => setRTL(false));

  describe('LTR (en / fr)', () => {
    beforeEach(() => setRTL(false));

    it('aligns start to the left', () => {
      expect(textAlignStart()).toBe('left');
    });

    it('aligns end to the right', () => {
      expect(textAlignEnd()).toBe('right');
    });

    it('leaves directional glyphs untouched', () => {
      expect(mirrorGlyph('›')).toBe('›');
      expect(mirrorGlyph('→')).toBe('→');
    });
  });

  describe('RTL (ar)', () => {
    beforeEach(() => setRTL(true));

    it('aligns start to the right', () => {
      expect(textAlignStart()).toBe('right');
    });

    it('aligns end to the left', () => {
      expect(textAlignEnd()).toBe('left');
    });

    it('mirrors directional glyphs', () => {
      expect(mirrorGlyph('›')).toBe('‹');
      expect(mirrorGlyph('→')).toBe('←');
      expect(mirrorGlyph('»')).toBe('«');
    });

    it('mirrors every glyph in a multi-character string', () => {
      expect(mirrorGlyph('→ next ›')).toBe('← next ‹');
    });

    it('leaves non-directional characters alone', () => {
      expect(mirrorGlyph('Resume')).toBe('Resume');
      expect(mirrorGlyph('متابعة')).toBe('متابعة');
    });
  });
});
