import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, defaultLocale, getLocaleConfig } from '@/i18n/config';
import { getAllPosts } from '@/lib/blog';

// Pages to include in sitemap
const pages = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/consumer', changeFrequency: 'monthly' as const, priority: 0.9 },
  { path: '/companies', changeFrequency: 'monthly' as const, priority: 0.9 },
  { path: '/marketplace-surprise-bag', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/humanity-mission', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/how-to-collect', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/mission-driven', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/esg', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/food-waste-facts', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/partners', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/careers', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/blog', changeFrequency: 'weekly' as const, priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
];

// Generate alternate language links for each page
function generateAlternateLinks(path: string): Record<string, string> {
  const alternates: Record<string, string> = {};

  locales.forEach(locale => {
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
  pages.forEach(page => {
    locales.forEach(locale => {
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

  // Add blog posts dynamically
  const posts = getAllPosts();
  posts.forEach(post => {
    locales.forEach(locale => {
      sitemapEntries.push({
        url: getCanonicalUrl(`/blog/${post.slug}`, locale),
        lastModified: new Date(post.date),
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: {
          languages: generateAlternateLinks(`/blog/${post.slug}`),
        },
      });
    });
  });

  return sitemapEntries;
}
