import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import { getAllPosts, getTranslationSlugs } from '@/lib/blog';
import { citySlugs } from '@/content/locations';

import type { Locale } from '@/i18n/config';

const PRIORITY = {
  homepage: 1.0,
  pillar: 0.9,
  milestone: 0.9,
  blog: 0.8,
  country: 0.8,
  marketing: 0.7,
  city: 0.7,
  support: 0.6,
  informational: 0.5,
} as const;

const marketingPages: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: PRIORITY.homepage },
  { path: '/consumer', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/marketplace-surprise-bag', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/humanity-mission', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/dream', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/esg', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/food-waste-facts', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/contact', changeFrequency: 'monthly', priority: PRIORITY.support },
  { path: '/careers', changeFrequency: 'monthly', priority: PRIORITY.informational },
  { path: '/companies', changeFrequency: 'monthly', priority: PRIORITY.support },
  { path: '/business-signup', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  // Added on master after this branch forked — kept, mapped onto the priority scale.
  { path: '/how-to-collect', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/mission-driven', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  { path: '/partners', changeFrequency: 'monthly', priority: PRIORITY.support },
  { path: '/blog', changeFrequency: 'weekly', priority: PRIORITY.blog },
  // Hub page for the city cluster — links to every /locations/{city} child.
  { path: '/locations', changeFrequency: 'monthly', priority: PRIORITY.pillar },
];

function buildAlternates(path: string): Record<string, string> {
  const alternates: Record<string, string> = {
    'x-default': getCanonicalUrl(path, 'en'),
  };
  locales.forEach((locale: Locale) => {
    alternates[getLocaleConfig(locale).hreflang] = getCanonicalUrl(path, locale);
  });
  return alternates;
}

function buildEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  locale: Locale,
  lastModified?: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: getCanonicalUrl(path, locale),
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority,
    alternates: { languages: buildAlternates(path) },
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  marketingPages.forEach(({ path, changeFrequency, priority }) => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(path, changeFrequency, priority, locale, now));
    });
  });

  // Blog posts cannot use buildEntry: slugs differ per locale (a French post
  // lives at its own French slug), so alternates must be resolved through the
  // shared translationKey rather than by reusing one path across locales.
  //
  // Only locales that have a real MDX file are emitted. Previously every post
  // was advertised in all three locales while only the English text existed,
  // so the sitemap declared French and Arabic versions that were actually
  // English pages — an hreflang claim contradicted by the page itself.
  locales.forEach((locale: Locale) => {
    getAllPosts(locale).forEach(post => {
      const translations = getTranslationSlugs(post.translationKey);
      const languages: Record<string, string> = {};

      (Object.entries(translations) as Array<[Locale, string]>).forEach(([l, s]) => {
        languages[getLocaleConfig(l).hreflang] = getCanonicalUrl(`/blog/${s}`, l);
      });
      const defaultSlug = translations['en'];
      if (defaultSlug) {
        languages['x-default'] = getCanonicalUrl(`/blog/${defaultSlug}`, 'en');
      }

      entries.push({
        url: getCanonicalUrl(`/blog/${post.slug}`, locale),
        lastModified: new Date(post.date),
        changeFrequency: 'monthly',
        priority: PRIORITY.blog,
        alternates: { languages },
      });
    });
  });

  // Driven by the same `cities` array the /locations/[city] route renders from,
  // so the sitemap can no longer advertise a city page that does not exist.
  citySlugs.forEach(city => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(`/locations/${city}`, 'weekly', PRIORITY.city, locale, now));
    });
  });

  return entries;
}
