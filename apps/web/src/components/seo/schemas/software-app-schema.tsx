import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface SoftwareAppSchemaProps {
  name: string;
  description: string;
  locale: Locale;
}

export function SoftwareAppSchema({ name, description, locale }: SoftwareAppSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'FoodAndDrink',
    operatingSystem: 'Android, iOS',
    inLanguage: locale,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TND' },
    author: { '@type': 'Organization', '@id': `${seoConfig.url}/#organization` },
    ...(seoConfig.appLinks.ios ? { downloadUrl: seoConfig.appLinks.ios } : {}),
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
