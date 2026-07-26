import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface OrganizationSchemaProps {
  locale: Locale;
}

export function OrganizationSchema({ locale }: OrganizationSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${seoConfig.url}/#organization`,
    name: seoConfig.business.name,
    legalName: seoConfig.business.legalName,
    url: `${seoConfig.url}/${locale}`,
    logo: {
      '@type': 'ImageObject',
      url: `${seoConfig.url}/images/logo.png`,
      width: 512,
      height: 512,
    },
    foundingDate: seoConfig.business.foundingDate,
    description: seoConfig.business.description[locale],
    address: {
      '@type': 'PostalAddress',
      addressLocality: seoConfig.business.address.addressLocality,
      addressCountry: seoConfig.business.address.addressCountry,
      postalCode: seoConfig.business.address.postalCode,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: seoConfig.email,
      contactType: 'customer service',
    },
    sameAs: [
      seoConfig.socialUrls.facebook,
      seoConfig.socialUrls.instagram,
      seoConfig.socialUrls.linkedin,
      seoConfig.socialUrls.x,
    ].filter(Boolean),
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
