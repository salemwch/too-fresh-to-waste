/**
 * Locale parity.
 *
 * The app ships en, fr and ar. A key present in one bundle and missing from
 * another renders as the raw key — "leaderboard.rankings" in the UI — which is
 * exactly the class of defect that shipped on the search and leaderboard
 * screens before they were fixed.
 *
 * Plural suffixes are compared by base key, not literally: Arabic has six CLDR
 * plural categories where English has two, so `_zero`/`_two`/`_few`/`_many`
 * legitimately exist only in ar.json. A naive key-set comparison would either
 * fail on every plural or have to be weakened until it caught nothing.
 */

import ar from '../locales/ar.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

/** i18next plural categories; the suffix is stripped before comparison. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

const stripPluralSuffix = (key: string): string => {
  const suffix = PLURAL_SUFFIXES.find(s => key.endsWith(s));
  return suffix != null ? key.slice(0, -suffix.length) : key;
};

/** Every leaf key path in a bundle, plural suffixes removed and deduplicated. */
const leafKeys = (bundle: object): Set<string> => {
  const keys = new Set<string>();

  const walk = (node: unknown, path: string): void => {
    if (node == null || typeof node !== 'object') {
      keys.add(stripPluralSuffix(path));
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, path === '' ? key : `${path}.${key}`);
    }
  };

  walk(bundle, '');
  return keys;
};

const EN = leafKeys(en);

describe('locale parity', () => {
  describe.each([
    ['fr', fr],
    ['ar', ar],
  ])('%s', (_locale, bundle) => {
    const keys = leafKeys(bundle);

    it('has every key English has', () => {
      const missing = [...EN].filter(key => !keys.has(key)).sort();

      expect(missing).toEqual([]);
    });

    // A key here but not in English is usually a rename that was only half
    // applied — the old key lingers, translated, and unreachable.
    it('has no keys English does not', () => {
      const extra = [...keys].filter(key => !EN.has(key)).sort();

      expect(extra).toEqual([]);
    });

    it('has no empty translations', () => {
      const empty: string[] = [];
      const walk = (node: unknown, path: string): void => {
        if (typeof node === 'string') {
          if (node.trim() === '') empty.push(path);
          return;
        }
        if (node == null || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          walk(value, path === '' ? key : `${path}.${key}`);
        }
      };
      walk(bundle, '');

      expect(empty).toEqual([]);
    });
  });

  /*
   * A translation may only use placeholders its English source provides. One it
   * invents is never substituted and renders as literal braces.
   *
   * The reverse is allowed, but only for plural forms. Arabic encodes small
   * counts in the noun itself — deliveryCount_one is "عملية توصيل واحدة", with
   * no {{count}} — and forcing the number back in would read as broken Arabic.
   * A non-plural key that drops a placeholder is a real defect, so those are
   * still compared exactly.
   */
  describe('interpolation placeholders', () => {
    const placeholdersOf = (value: string): string[] =>
      (value.match(/\{\{(\w+)\}\}/gu) ?? []).sort();

    const flatten = (node: unknown, path: string, out: Map<string, string>): void => {
      if (typeof node === 'string') {
        out.set(path, node);
        return;
      }
      if (node == null || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        flatten(value, path === '' ? key : `${path}.${key}`, out);
      }
    };

    const flatEn = new Map<string, string>();
    flatten(en, '', flatEn);

    it.each([
      ['fr', fr],
      ['ar', ar],
    ])('%s uses the same placeholders as English', (_locale, bundle) => {
      const flat = new Map<string, string>();
      flatten(bundle, '', flat);

      const mismatched = [...flat.entries()]
        .filter(([path, value]) => {
          // A plural form with no English counterpart (ar _two/_few/_many)
          // falls back to the base key's source for comparison.
          const source = flatEn.get(path) ?? flatEn.get(`${stripPluralSuffix(path)}_other`);
          if (source == null) return false;

          const allowed = new Set(placeholdersOf(source));
          const used = placeholdersOf(value);

          // Never invent a placeholder the source cannot fill.
          if (used.some(token => !allowed.has(token))) return true;

          // Dropping one is only acceptable in a plural form.
          const isPluralForm = stripPluralSuffix(path) !== path;
          return !isPluralForm && used.length !== allowed.size;
        })
        .map(([path]) => path)
        .sort();

      expect(mismatched).toEqual([]);
    });

    // The rule above is only useful if it still fails on a real mistake.
    it('rejects a placeholder the source cannot fill', () => {
      const source = 'Ends {{date}}';
      const translated = 'Se termine le {{jour}}';

      const allowed = new Set(placeholdersOf(source));

      expect(placeholdersOf(translated).some(token => !allowed.has(token))).toBe(true);
    });
  });
});
