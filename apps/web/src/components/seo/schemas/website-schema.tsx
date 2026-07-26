import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface WebSiteSchemaProps {
  locale?: Locale;
}

export function WebSiteSchema({ locale: _locale = 'en' }: WebSiteSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${seoConfig.url}/#website`,
    name: 'Too Fresh To Waste',
    url: seoConfig.url,
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
