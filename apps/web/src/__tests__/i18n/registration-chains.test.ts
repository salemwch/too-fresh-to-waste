/**
 * Registration chains: every key that is declared in one file and resolved in
 * another must exist on both ends.
 *
 * ## Why this suite exists
 *
 * Adding a feature here is rarely one edit. A sidebar entry is a `titleKey` in
 * `navigation.config.ts` AND a label in three locale files. A page is a route
 * AND a namespace in its layout's `*_NAMESPACES` array. Miss the second half
 * and nothing fails: `tsc` sees a string, the build succeeds, the tests pass,
 * and the defect surfaces as `MISSING_MESSAGE` in a user's console.
 *
 * That is exactly what happened with the admin commission page - the nav entry
 * shipped without `dashboard.nav.commission`, and the error only appeared when
 * someone opened an unrelated admin tab.
 *
 * These are cheap, exhaustive checks over the whole tree rather than a rule
 * anyone has to remember. A new nav item with no label fails here, in CI,
 * before it reaches a browser.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ar from '@/messages/ar.json';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const LOCALES = { en, fr, ar } as const;
type LocaleName = keyof typeof LOCALES;
const LOCALE_NAMES = Object.keys(LOCALES) as LocaleName[];

/** Resolves `a.b.c` against a messages object. */
function lookup(messages: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        typeof acc === 'object' && acc !== null ? (acc as Record<string, unknown>)[key] : undefined,
      messages,
    );
}

// ─── Sidebar navigation ──────────────────────────────────────────────────────

describe('navigation config resolves against every locale', () => {
  const navSource = read('src/config/navigation.config.ts');
  const titleKeys = [...new Set([...navSource.matchAll(/titleKey: '([^']+)'/g)].map(m => m[1]!))];

  it('finds nav entries to check, so this suite is not vacuous', () => {
    expect(titleKeys.length).toBeGreaterThan(10);
  });

  it.each(LOCALE_NAMES)('every titleKey has a label in %s', locale => {
    const missing = titleKeys.filter(key => !lookup(LOCALES[locale], `dashboard.nav.${key}`));

    // Named rather than counted: the failure message should say which entry to
    // add, not just that one is absent.
    expect(missing).toEqual([]);
  });

  it('every nav href points at a route that exists', () => {
    const hrefs = [...new Set([...navSource.matchAll(/href: '(\/[^']+)'/g)].map(m => m[1]!))];

    // A nav entry pointing at a missing route is a 404 reachable from the
    // sidebar - the same class of defect as a missing label, one layer out.
    const missing = hrefs.filter(href => {
      const candidates = [
        `src/app/[locale]/(admin)${href}/page.tsx`,
        `src/app/[locale]/(merchant)${href}/page.tsx`,
        `src/app/[locale]${href}/page.tsx`,
      ];
      return !candidates.some(rel => {
        try {
          read(rel);
          return true;
        } catch {
          return false;
        }
      });
    });

    expect(missing).toEqual([]);
  });
});

// ─── Route-group namespaces ──────────────────────────────────────────────────

/**
 * `pickMessages` hands a client only the namespaces its layout lists. A page
 * using a namespace the layout never registered renders raw `namespace.key`
 * strings - see `.claude/rules/web.md` rule 11.
 */
describe('route-group layouts register the namespaces their pages use', () => {
  const GROUPS = [
    { name: 'admin', layout: 'src/app/[locale]/(admin)/layout.tsx' },
    { name: 'merchant', layout: 'src/app/[locale]/(merchant)/layout.tsx' },
  ] as const;

  it.each(GROUPS)('$name registers every namespace it declares', ({ layout }) => {
    const source = read(layout);
    const block = source.match(/_NAMESPACES = \[([\s\S]*?)\] as const;/);

    expect(block).not.toBeNull();

    const declared = [...block![1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!);
    expect(declared.length).toBeGreaterThan(3);

    // A namespace registered but absent from the messages is dead weight that
    // silently ships nothing; one that is present but unregistered is the
    // raw-key bug. This catches the first; the locale-parity suite catches keys.
    const unknown = declared.filter(ns => !(ns in (en as Record<string, unknown>)));
    expect(unknown).toEqual([]);
  });
});

// ─── Locale parity for every namespace ───────────────────────────────────────

describe('locales carry identical key sets', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  /**
   * Namespaces added since this suite was written are covered automatically:
   * the list is derived from `en`, not restated. A namespace added to one
   * locale only fails here without anyone remembering to extend a fixture.
   */
  const namespaces = Object.keys(en as Record<string, unknown>);

  it('has namespaces to compare', () => {
    expect(namespaces.length).toBeGreaterThan(10);
  });

  it.each(['fr', 'ar'] as const)('%s matches en key for key', locale => {
    const enKeys = new Set(flatten(en));
    const otherKeys = new Set(flatten(LOCALES[locale]));

    const missingInOther = [...enKeys].filter(k => !otherKeys.has(k));
    const extraInOther = [...otherKeys].filter(k => !enKeys.has(k));

    expect({ missing: missingInOther, extra: extraInOther }).toEqual({ missing: [], extra: [] });
  });
});
