import type { Metadata } from 'next';
import { getCanonicalUrl, seoConfig } from '@/config/seo.config';
import { getLocaleConfig } from '@/i18n/config';
import { SOURCE_LOCALE, translatedLocalesFor } from '@/config/translated-routes';

import type { Locale } from '@/i18n/config';

/**
 * Applied to every authenticated / transactional route group.
 *
 * robots.txt only asks a crawler not to fetch a URL; it does not stop that URL
 * being indexed when something links to it. `noindex` is the binding
 * instruction, so private areas need both. `follow` stays on so link equity
 * still flows back out to the public pages these shells link to.
 */
export const NOINDEX_METADATA = {
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
} as const satisfies Metadata;

export interface PageMetadataInput {
  /** Route path without the locale prefix, e.g. '/careers'. */
  path: string;
  locale: Locale;
  title: string;
  description: string;
  /** Set for pages that must stay out of the index (thin, gated or duplicate). */
  noIndex?: boolean;
  /** Override the shared OG image for pages with bespoke artwork. */
  ogImage?: string;
}

/**
 * Builds the canonical + hreflang + Open Graph block every indexable page needs.
 *
 * `alternates.languages` is what stops Google treating the fr / ar / en
 * versions as duplicates competing with each other, and `x-default` tells it
 * which to show when it cannot infer a language preference. Getting this wrong
 * on a multilingual site costs more traffic than almost any other technical
 * mistake, so it lives in one place.
 *
 * It only advertises locales the route actually serves. A page whose copy is
 * still hardcoded English lists English alone, and its non-English URLs get
 * `noindex` with the canonical pointing at the English one. Claiming a French
 * alternate that returns English text is worse than claiming none, because it
 * makes the whole cluster untrustworthy rather than merely incomplete. See
 * `config/translated-routes.ts`.
 */
export function buildPageMetadata({
  path,
  locale,
  title,
  description,
  noIndex = false,
  ogImage = seoConfig.ogImage,
}: PageMetadataInput): Metadata {
  const available = translatedLocalesFor(path);
  const languages: Record<string, string> = {
    'x-default': getCanonicalUrl(path, SOURCE_LOCALE),
  };
  available.forEach(l => {
    languages[getLocaleConfig(l).hreflang] = getCanonicalUrl(path, l);
  });

  /**
   * A locale variant we do not actually serve points its canonical home rather
   * than at itself, so the duplicate consolidates instead of competing.
   */
  const servesThisLocale = available.includes(locale);
  const url = getCanonicalUrl(path, servesThisLocale ? locale : SOURCE_LOCALE);
  const hideFromIndex = noIndex || !servesThisLocale;

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: seoConfig.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: seoConfig.twitterCard,
      title,
      description,
      images: [ogImage],
    },
    ...(hideFromIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Per-locale copy for a page's title and description. */
export type LocalizedMeta = Record<Locale, { title: string; description: string }>;

/** Convenience wrapper for the common "three locales of copy" shape. */
export function buildLocalizedPageMetadata(
  path: string,
  locale: Locale,
  copy: LocalizedMeta,
  options: { noIndex?: boolean } = {},
): Metadata {
  const entry = copy[locale] ?? copy.en;
  return buildPageMetadata({
    path,
    locale,
    title: entry.title,
    description: entry.description,
    ...(options.noIndex === undefined ? {} : { noIndex: options.noIndex }),
  });
}
