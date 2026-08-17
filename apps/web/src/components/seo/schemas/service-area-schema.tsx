import { seoConfig, getCanonicalUrl } from '@/config/seo.config';
import { t, type CityContent } from '@/content/locations';

import type { Locale } from '@/i18n/config';

interface ServiceAreaSchemaProps {
  city: CityContent;
  locale: Locale;
}

/**
 * `Service` + `areaServed`, deliberately NOT `LocalBusiness`.
 *
 * Google requires a `LocalBusiness` entity to have a genuine physical location
 * that customers can visit. We operate a marketplace, not a branch in each of
 * these seven cities, so emitting `LocalBusiness` with an invented street
 * address per city is a structured-data spam signal and a manual-action risk.
 * `Service` with a `GeoCircle` area served is the accurate description and is
 * fully eligible for the same entity understanding.
 */
export function ServiceAreaSchema({ city, locale }: ServiceAreaSchemaProps) {
  const cityName = t(city.name, locale);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${getCanonicalUrl(`/locations/${city.slug}`, 'en')}#service`,
    name: t(city.metaTitle, locale),
    description: t(city.metaDescription, locale),
    serviceType: 'Surplus food marketplace',
    url: getCanonicalUrl(`/locations/${city.slug}`, locale),
    provider: {
      '@type': 'Organization',
      '@id': `${seoConfig.url}/#organization`,
      name: seoConfig.business.name,
      url: seoConfig.url,
    },
    areaServed: [
      {
        '@type': 'City',
        name: cityName,
        containedInPlace: {
          '@type': 'Country',
          name: 'Tunisia',
          identifier: 'TN',
        },
        geo: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: city.coordinates.lat,
            longitude: city.coordinates.lng,
          },
          geoRadius: city.serviceRadiusMeters,
        },
      },
    ],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: getCanonicalUrl(`/locations/${city.slug}`, locale),
      availableLanguage: [
        { '@type': 'Language', name: 'French', alternateName: 'fr' },
        { '@type': 'Language', name: 'Arabic', alternateName: 'ar' },
        { '@type': 'Language', name: 'English', alternateName: 'en' },
      ],
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'TND',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: 3,
        priceCurrency: 'TND',
      },
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
