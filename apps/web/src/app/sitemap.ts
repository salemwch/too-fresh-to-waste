import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import { getAllPosts } from '@/lib/blog';
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

  // Blog posts (from master) — rebuilt on the branch's buildEntry helper so
  // they pick up the same hreflang alternates as every other entry.
  getAllPosts().forEach(post => {
    locales.forEach((locale: Locale) => {
      entries.push(
        buildEntry(`/blog/${post.slug}`, 'monthly', PRIORITY.blog, locale, new Date(post.date)),
      );
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
