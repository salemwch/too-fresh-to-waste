import { MetadataRoute } from 'next';
import { seoConfig } from '@/config/seo.config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = seoConfig.url;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/_next/',
          '/private/',
          '/*.json$', // Block JSON files
          '/search?*', // Block search results with parameters
        ],
      },
      // Google specific rules
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/_next/', '/private/'],
      },
      // Block AI crawlers if desired (optional - remove if you want AI visibility)
      // {
      //   userAgent: 'GPTBot',
      //   disallow: '/',
      // },
      // {
      //   userAgent: 'ChatGPT-User',
      //   disallow: '/',
      // },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
