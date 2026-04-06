import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, defaultLocale, getLocaleConfig } from '@/i18n/config';

// Pages to include in sitemap
const pages = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/about', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/how-it-works', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/business', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly' as const, priority: 0.6 },
  // Add more pages as they're created
];

// Generate alternate language links for each page
function generateAlternateLinks(path: string): Record<string, string> {
  const alternates: Record<string, string> = {};

  locales.forEach((locale) => {
    const hreflang = getLocaleConfig(locale).hreflang;
    alternates[hreflang] = getCanonicalUrl(path, locale);
  });

  // Add x-default pointing to default locale
  alternates['x-default'] = getCanonicalUrl(path, defaultLocale);

  return alternates;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Generate entries for each page in each locale
  pages.forEach((page) => {
    locales.forEach((locale) => {
      sitemapEntries.push({
        url: getCanonicalUrl(page.path, locale),
        lastModified: currentDate,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: generateAlternateLinks(page.path),
        },
      });
    });
  });

  // Add service area landing pages for Tunisia cities
  // These are important for local SEO
  const tunisiaCities = ['tunis', 'sousse', 'sfax', 'monastir', 'hammamet', 'bizerte', 'nabeul'];

  tunisiaCities.forEach((city) => {
    locales.forEach((locale) => {
      sitemapEntries.push({
        url: getCanonicalUrl(`/locations/${city}`, locale),
        lastModified: currentDate,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: {
          languages: generateAlternateLinks(`/locations/${city}`),
        },
      });
    });
  });

  return sitemapEntries;
}
