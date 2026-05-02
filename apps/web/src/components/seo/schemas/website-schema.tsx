import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface WebSiteSchemaProps {
  locale?: Locale;
}

export function WebSiteSchema({ locale = 'en' }: WebSiteSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${seoConfig.url}/#website`,
    name: 'Too Fresh To Waste',
    url: seoConfig.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${seoConfig.url}/${locale}/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
