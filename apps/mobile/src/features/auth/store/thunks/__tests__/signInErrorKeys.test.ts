import { readFileSync } from 'fs';
import { join } from 'path';

import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

/**
 * The sign-in thunks report failures as i18n keys rather than English
 * sentences. That is a two-ended chain: the key is chosen in
 * `signIn.thunks.ts` and resolved in three locale files, and nothing in the
 * compiler connects them. Add a key to `en.json` only and every screen still
 * builds, type-checks and passes - the defect surfaces as a raw dotted path on
 * a phone set to French.
 *
 * So this reads the keys straight out of the thunk source and demands all three
 * bundles answer for each one. The list cannot go stale, because it is not a
 * list: it is whatever the file currently emits.
 *
 * See `.claude/rules/registration-chains.md` - `dashboard.nav.commission`
 * shipped exactly this way.
 */

const THUNK_PATH = join(__dirname, '..', 'signIn.thunks.ts');

/**
 * Matches the quoted `auth.*` literals the thunk assigns as messages.
 *
 * Deliberately narrow: only the `auth` namespace, only inside single quotes,
 * which is how every key in this file is written. A key added in another
 * namespace would escape this and is the known limit of the check.
 */
const AUTH_KEY_LITERAL = /'(auth\.[a-zA-Z0-9_]+)'/g;

function extractAuthKeys(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(AUTH_KEY_LITERAL)) {
    const key = match[1];
    if (key !== undefined) found.add(key);
  }
  return [...found].sort();
}

function lookup(bundle: unknown, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
}

const source = readFileSync(THUNK_PATH, 'utf8');
const keys = extractAuthKeys(source);

describe('sign-in error keys resolve in every locale', () => {
  it('finds keys in the thunk at all', () => {
    // Guards the regex itself. If a refactor changes how keys are written, the
    // per-key suite below would silently become an empty suite that passes.
    expect(keys.length).toBeGreaterThanOrEqual(8);
  });

  describe.each([
    ['en', en],
    ['fr', fr],
    ['ar', ar],
  ])('%s', (locale, bundle) => {
    it.each(keys)('translates %s', key => {
      const value = lookup(bundle, key);

      expect(typeof value).toBe('string');
      // An empty string is a present key that renders nothing - the same blank
      // row a missing key would produce, minus the warning.
      expect(value).not.toBe('');
      // Arabic and French must not be left holding the English copy. Compared
      // against `en` rather than a word list so it stays true as copy changes.
      if (locale !== 'en') {
        expect(value).not.toBe(lookup(en, key));
      }
    });
  });
});
