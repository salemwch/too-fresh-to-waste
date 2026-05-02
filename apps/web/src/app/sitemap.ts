import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

const PRIORITY = {
  homepage: 1.0,
  pillar: 0.9,
  milestone: 0.9,
  blog: 0.8,
  country: 0.8,
  marketing: 0.7,
  city: 0.7,
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
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/careers', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/companies', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/business-signup', changeFrequency: 'monthly', priority: 0.7 },
];

const pillarPages: string[] = [
  '/food-waste-mena',
  '/sustainable-eating',
  '/food-donations-north-africa',
  '/esg-restaurants',
  '/surprise-bag-guide',
  '/zero-hunger',
  '/food-rewards-apps',
  '/food-carbon-footprint',
];

const tunisiaCities = ['tunis', 'sousse', 'sfax', 'monastir', 'hammamet', 'bizerte', 'nabeul'];

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

  pillarPages.forEach(path => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(path, 'monthly', PRIORITY.pillar, locale, now));
    });
  });

  tunisiaCities.forEach(city => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(`/locations/${city}`, 'weekly', PRIORITY.city, locale, now));
    });
  });

  return entries;
}
