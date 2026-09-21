import { resolveLocalisedText, type LocalisedText } from '../localised-text';

/**
 * The fallback rule for admin-authored content.
 *
 * This resolver decides what a customer reads when an admin has supplied a
 * prize name in some languages and not others. Backend, web and mobile all call
 * it, which is the point: three implementations of "which string do I show"
 * would drift, and the drift would be invisible until a customer in one locale
 * saw a blank where a prize name belonged.
 *
 * The cases that matter are the absent ones, so they are enumerated rather than
 * sampled.
 */

const DEFAULT = 'Latest Smartphone';

const FULL: LocalisedText = {
  fr: 'Dernier smartphone',
  ar: 'أحدث هاتف ذكي',
};

describe('resolveLocalisedText', () => {
  describe('a variant exists for the reader', () => {
    it('returns the French variant for fr', () => {
      expect(resolveLocalisedText(DEFAULT, FULL, 'fr')).toBe('Dernier smartphone');
    });

    it('returns the Arabic variant for ar', () => {
      expect(resolveLocalisedText(DEFAULT, FULL, 'ar')).toBe('أحدث هاتف ذكي');
    });

    it('tolerates a region suffix', () => {
      // next-intl is configured with bare codes, but a locale forwarded from a
      // header or stored on a profile may carry a region. Falling back to
      // English for "fr-TN" would be wrong in the one market this app serves.
      expect(resolveLocalisedText(DEFAULT, FULL, 'fr-TN')).toBe('Dernier smartphone');
      expect(resolveLocalisedText(DEFAULT, FULL, 'ar-TN')).toBe('أحدث هاتف ذكي');
    });
  });

  describe('no usable variant', () => {
    it.each([
      ['no variants object at all', undefined],
      ['an explicitly null variants object', null],
      ['an empty variants object', {}],
      ['a variants object with only the other language', { ar: 'أحدث هاتف ذكي' }],
      ['an undefined entry', { fr: undefined }],
      ['an empty string', { fr: '' }],
      ['a whitespace-only string', { fr: '   ' }],
      ['a newline-only string', { fr: '\n\t' }],
    ])('falls back to the default given %s', (_label, variants) => {
      // Blank counts as absent: an admin who opened the field, typed nothing
      // and saved has not authored a French name, and rendering '' would leave
      // a gap where the prize should be.
      expect(resolveLocalisedText(DEFAULT, variants as LocalisedText | null, 'fr')).toBe(DEFAULT);
    });

    it('falls back for English, which has no variant slot by design', () => {
      // The default field *is* the English copy - there is no `en` key to add.
      expect(resolveLocalisedText(DEFAULT, FULL, 'en')).toBe(DEFAULT);
    });

    it.each(['de', 'es', 'zh', '', 'not-a-locale'])(
      'falls back for the unsupported locale %p',
      locale => {
        expect(resolveLocalisedText(DEFAULT, FULL, locale)).toBe(DEFAULT);
      },
    );
  });

  describe('it never returns nothing', () => {
    it.each([['fr', 'ar', 'en', 'fr-TN', 'de', '']].flat())(
      'returns a non-empty string for locale %p',
      locale => {
        // The guarantee every call site relies on: whatever the inputs, there is
        // always something to render.
        const result = resolveLocalisedText(DEFAULT, { fr: '', ar: '  ' }, locale);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      },
    );

    it('returns the default verbatim, including its own whitespace', () => {
      // The default is required upstream, so it is not this function's job to
      // second-guess it - only to pick it.
      expect(resolveLocalisedText('  Spaced  ', {}, 'fr')).toBe('  Spaced  ');
    });
  });

  describe('it does not mutate its inputs', () => {
    it('leaves the variants object untouched', () => {
      const variants: LocalisedText = { fr: 'Dernier smartphone' };
      const before = JSON.stringify(variants);

      resolveLocalisedText(DEFAULT, variants, 'ar');

      expect(JSON.stringify(variants)).toBe(before);
    });
  });
});
