/**
 * A blog post must be findable by the slug that reaches the route.
 *
 * Arabic posts shipped as 37-byte shells. `params` percent-encodes any slug
 * containing non-ASCII, the filename on disk does not, so `getPostBySlug`
 * looked up `%D9%85%D8%A7-....mdx`, found nothing, and `generateMetadata`
 * returned `{}`. The article then inherited the root layout's canonical and
 * declared itself to be `/ar`.
 *
 * Every gate we run passed. The build reported six extra prerendered pages,
 * the blog index linked to all of them, type-check and lint were clean, and
 * check-canonical-tags said the site was fine - because it compared an encoded
 * href against a decoded filename, failed to match either, and skipped them.
 *
 * So the test is the round trip: take the slug as the route would deliver it,
 * and require the post back.
 */

import { getAllPostParams, getPostBySlug, getTranslationSlugs } from '@/lib/blog';
import { locales } from '@/i18n/config';

const params = getAllPostParams();

describe('every post is reachable by its encoded slug', () => {
  it('finds posts to check, so this suite is not vacuous', () => {
    expect(params.length).toBeGreaterThan(10);
  });

  it.each(params)('$locale/$slug resolves from the raw filename', ({ locale, slug }) => {
    expect(getPostBySlug(slug, locale)).not.toBeNull();
  });

  it.each(params)(
    '$locale/$slug resolves from the percent-encoded form the route delivers',
    ({ locale, slug }) => {
      expect(getPostBySlug(encodeURIComponent(slug), locale)).not.toBeNull();
    },
  );

  it('returns null for a slug that has no file, rather than guessing', () => {
    expect(getPostBySlug('no-such-post', 'en')).toBeNull();
    expect(getPostBySlug('%D9%84%D8%A7-%D9%8A%D9%88%D8%AC%D8%AF', 'ar')).toBeNull();
  });

  it('survives a malformed escape sequence without throwing', () => {
    expect(() => getPostBySlug('%E0%A4%A', 'ar')).not.toThrow();
    expect(getPostBySlug('%E0%A4%A', 'ar')).toBeNull();
  });
});

describe('every locale has posts', () => {
  it.each(locales)('%s has at least one article', locale => {
    expect(params.filter(p => p.locale === locale).length).toBeGreaterThan(0);
  });
});

describe('translation clusters', () => {
  const keys = [
    ...new Set(params.map(({ locale, slug }) => getPostBySlug(slug, locale)?.translationKey)),
  ];

  it('groups every post under a translationKey', () => {
    expect(keys.filter(k => k === undefined)).toEqual([]);
  });

  it.each(keys as string[])('%s points every listed locale at a real post', key => {
    const cluster = getTranslationSlugs(key);
    for (const [locale, slug] of Object.entries(cluster)) {
      expect(getPostBySlug(slug, locale as (typeof locales)[number])).not.toBeNull();
    }
  });

  it('never lists a locale in a cluster that has no file for it', () => {
    for (const key of keys as string[]) {
      const cluster = getTranslationSlugs(key);
      for (const locale of Object.keys(cluster)) {
        expect(locales).toContain(locale);
      }
    }
  });
});
