import { locales } from '@/i18n/config';

import type { Locale } from '@/i18n/config';

/**
 * Which routes actually serve translated copy.
 *
 * The site advertises `en`, `fr-TN` and `ar-TN` alternates on every page. For
 * most marketing routes that is a promise we do not keep: the component holds
 * hardcoded English, so `/fr/esg` and `/ar/esg` serve the same words as
 * `/en/esg` while telling Google they are the French and Arabic versions.
 *
 * Google's guidance on this is explicit - hreflang describes translations, and
 * pointing it at untranslated copy makes the cluster untrustworthy rather than
 * merely unhelpful. The three URLs then compete as duplicates and one is picked
 * arbitrarily. `.claude/rules/seo.md` calls this the most expensive technical
 * mistake available on this site, which is why the alternates block lives in
 * exactly one function and why this list sits next to it.
 *
 * So an untranslated route advertises English only, and its non-English URLs
 * carry `noindex` with a canonical pointing at the English one. That is the
 * standard interim position: the page still works in every locale, it simply
 * stops claiming to be something it is not.
 *
 * **Moving a route here is the last step of translating it, not the first.**
 * Add the namespace to `messages/{en,fr,ar}.json`, convert the page to
 * `getTranslations`, then add the path here. `translated-routes.test.ts` checks
 * that every path listed has a real namespace behind it.
 */
export const FULLY_TRANSLATED_ROUTES = new Set<string>([
  '/',
  '/blog',
  '/companies',
  '/consumer',
  '/contact',
  '/dream',
  '/food-waste-facts',
  '/how-to-collect',
  '/humanity-mission',
  '/locations',
  '/marketplace-surprise-bag',
  '/parcless-bag',
  '/partners',
]);

/**
 * Routes whose copy is still English-only, kept explicit rather than inferred.
 *
 * Listing them makes the debt countable and stops a new marketing page quietly
 * joining the set by being neither translated nor declared.
 *
 * Both lists come from `scripts/check-translation-coverage.mjs`, which compares
 * the visible words of the prerendered `/fr/<route>` against `/en/<route>`. The
 * split is unambiguous: every translated page shares under 46% of its English
 * text, every untranslated one shares over 85%, and nothing lands between.
 *
 * That measurement is here because guessing was wrong in both directions. I
 * first classified these by grepping for `useTranslations`, which filed
 * `/locations`, `/blog`, `/dream` and `/parcless-bag` as English when they are
 * translated through locale-keyed objects instead, and missed the six legal
 * pages entirely because I never thought to look at them.
 */
export const ENGLISH_ONLY_ROUTES = new Set<string>([
  '/account-deletion',
  '/careers',
  '/cookie-policy',
  '/esg',
  '/mission-driven',
  '/partner-kit',
  '/privacy-policy',
  '/security',
  '/terms-and-conditions',
  '/terms-of-service',
]);

/** The default locale, and the only one an untranslated route may advertise. */
export const SOURCE_LOCALE: Locale = 'en';

/**
 * The locales a given path may legitimately claim in `alternates.languages`.
 *
 * Matching is prefix-based so nested routes inherit their section's status:
 * `/blog/some-post` and `/locations/tunis` follow `/blog` and `/locations`.
 */
export function translatedLocalesFor(path: string): readonly Locale[] {
  if (isFullyTranslated(path)) return locales;
  return [SOURCE_LOCALE];
}

export function isFullyTranslated(path: string): boolean {
  if (FULLY_TRANSLATED_ROUTES.has(path)) return true;
  return [...FULLY_TRANSLATED_ROUTES].some(route => route !== '/' && path.startsWith(`${route}/`));
}
