/**
 * A page may only advertise a language it actually serves.
 *
 * Every marketing page emitted `alternates.languages` for en, fr-TN and ar-TN
 * regardless of whether translated copy existed, so `/fr/esg` told Google it
 * was the French version of a page that returns English. Google's guidance is
 * that hreflang describes translations; pointing it at untranslated copy makes
 * the whole cluster untrustworthy rather than merely incomplete, and the three
 * URLs then compete as duplicates with one picked arbitrarily.
 *
 * `.claude/rules/seo.md` calls this the most expensive technical mistake
 * available on this site. These tests are what stop it coming back, because
 * nothing else can see it: a page that advertises a language it does not speak
 * type-checks, builds, renders and looks completely correct.
 */

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENGLISH_ONLY_ROUTES,
  FULLY_TRANSLATED_ROUTES,
  SOURCE_LOCALE,
  isFullyTranslated,
  translatedLocalesFor,
} from '@/config/translated-routes';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { locales } from '@/i18n/config';

const MARKETING = join(process.cwd(), 'src/app/[locale]/(marketing)');

/** Top-level marketing routes that render a page, from the filesystem. */
const marketingRoutes = readdirSync(MARKETING, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('(') && !e.name.startsWith('_'))
  .map(e => `/${e.name}`)
  .filter(route => existsSync(join(MARKETING, route.slice(1), 'page.tsx')));

describe('the two lists are a partition, not two opinions', () => {
  it('found marketing routes to check, so this suite is not vacuous', () => {
    expect(marketingRoutes.length).toBeGreaterThan(8);
  });

  it('classifies no route as both translated and English-only', () => {
    const both = [...FULLY_TRANSLATED_ROUTES].filter(r => ENGLISH_ONLY_ROUTES.has(r));
    expect(both).toEqual([]);
  });

  it('classifies every marketing route that renders a page', () => {
    const unclassified = marketingRoutes.filter(
      route =>
        !FULLY_TRANSLATED_ROUTES.has(route) &&
        !ENGLISH_ONLY_ROUTES.has(route) &&
        // A redirect renders nothing, so it carries no translation debt.
        route !== '/coming-soon',
    );
    expect(unclassified).toEqual([]);
  });
});

describe('what each route may advertise', () => {
  it.each([...FULLY_TRANSLATED_ROUTES])('%s advertises all three locales', route => {
    expect([...translatedLocalesFor(route)].sort()).toEqual([...locales].sort());
  });

  it.each([...ENGLISH_ONLY_ROUTES])('%s advertises English alone', route => {
    expect(translatedLocalesFor(route)).toEqual([SOURCE_LOCALE]);
  });

  it('lets a nested route inherit its section', () => {
    expect(isFullyTranslated('/locations/tunis')).toBe(true);
    expect(isFullyTranslated('/blog/some-post')).toBe(true);
  });

  it('does not let a prefix match leak across route names', () => {
    // '/blog' must not make '/blogging-tips' translated by string prefix.
    expect(isFullyTranslated('/blogging-tips')).toBe(false);
  });

  it('does not let the root make every route translated', () => {
    expect(isFullyTranslated('/definitely-not-a-route')).toBe(false);
  });
});

describe('the metadata that actually ships', () => {
  const languagesOf = (path: string, locale: (typeof locales)[number]) =>
    buildPageMetadata({ path, locale, title: 't', description: 'd' }).alternates?.languages ?? {};

  it('gives a translated route all three hreflang entries plus x-default', () => {
    expect(Object.keys(languagesOf('/companies', 'en')).sort()).toEqual(
      ['ar-TN', 'en', 'fr-TN', 'x-default'].sort(),
    );
  });

  it('gives an English-only route just English and x-default', () => {
    expect(Object.keys(languagesOf('/esg', 'en')).sort()).toEqual(['en', 'x-default'].sort());
  });

  it.each(['fr', 'ar'] as const)(
    'points an English-only route canonical home when reached as /%s',
    locale => {
      const meta = buildPageMetadata({ path: '/esg', locale, title: 't', description: 'd' });
      expect(meta.alternates?.canonical).toContain('/en/esg');
      expect(meta.alternates?.canonical).not.toContain(`/${locale}/esg`);
    },
  );

  it.each(['fr', 'ar'] as const)('noindexes the untranslated /%s variant', locale => {
    const meta = buildPageMetadata({ path: '/esg', locale, title: 't', description: 'd' });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('leaves a translated route indexable in every locale', () => {
    for (const locale of locales) {
      const meta = buildPageMetadata({ path: '/companies', locale, title: 't', description: 'd' });
      expect(meta.robots).toBeUndefined();
      expect(meta.alternates?.canonical).toContain(`/${locale}/companies`);
    }
  });

  it('still honours an explicit noIndex on a translated route', () => {
    const meta = buildPageMetadata({
      path: '/companies',
      locale: 'en',
      title: 't',
      description: 'd',
      noIndex: true,
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});

describe('pages that inherited the homepage canonical', () => {
  /**
   * These export a static metadata object with `robots: { index: true }` but no
   * `alternates`, and Next.js inherits that field from the root layout - whose
   * canonical is the homepage, because it is the homepage's layout. So each one
   * simultaneously asked to be indexed and declared itself a duplicate of `/`.
   * The canonical is the stronger instruction.
   */
  it.each([
    '/privacy-policy',
    '/terms-of-service',
    '/terms-and-conditions',
    '/cookie-policy',
    '/account-deletion',
    '/security',
    '/partner-kit',
  ])('%s is canonical to itself', route => {
    const meta = buildPageMetadata({ path: route, locale: 'en', title: 't', description: 'd' });
    expect(meta.alternates?.canonical).toContain(`/en${route}`);
  });
});
