import { seoConfig, getLocaleSeoMetadata } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface StructuredDataProps {
  locale?: Locale;
}

// Organization Schema - Tunisia-focused
export function OrganizationStructuredData({ locale = 'fr' }: StructuredDataProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${seoConfig.url}/#organization`,
    name: seoConfig.business.name,
    legalName: seoConfig.business.legalName,
    url: seoConfig.url,
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
      streetAddress: seoConfig.business.address.streetAddress,
      addressLocality: seoConfig.business.address.addressLocality,
      addressRegion: seoConfig.business.address.addressRegion,
      postalCode: seoConfig.business.address.postalCode,
      addressCountry: seoConfig.business.address.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: seoConfig.business.geo.latitude,
      longitude: seoConfig.business.geo.longitude,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: seoConfig.phone,
        contactType: 'customer service',
        email: seoConfig.email,
        availableLanguage: ['French', 'Arabic', 'English'],
        areaServed: {
          '@type': 'Country',
          name: 'Tunisia',
        },
      },
    ],
    sameAs: [
      `https://facebook.com/${seoConfig.social.facebook}`,
      `https://instagram.com/${seoConfig.social.instagram}`,
      `https://linkedin.com/${seoConfig.social.linkedin}`,
      `https://tiktok.com/${seoConfig.social.tiktok}`,
    ],
    areaServed: seoConfig.business.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area.name,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: area.coordinates.lat,
        longitude: area.coordinates.lng,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Website Schema with Search Action
export function WebsiteStructuredData({ locale = 'fr' }: StructuredDataProps) {
  const localeMetadata = getLocaleSeoMetadata(locale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${seoConfig.url}/#website`,
    name: seoConfig.siteName,
    url: seoConfig.url,
    description: localeMetadata.description,
    inLanguage: [
      { '@type': 'Language', name: 'French', alternateName: 'fr' },
      { '@type': 'Language', name: 'Arabic', alternateName: 'ar' },
      { '@type': 'Language', name: 'English', alternateName: 'en' },
    ],
    publisher: {
      '@id': `${seoConfig.url}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${seoConfig.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Mobile Application Schema - Critical for App SEO
export function MobileApplicationStructuredData({ locale = 'fr' }: StructuredDataProps) {
  const localeMetadata = getLocaleSeoMetadata(locale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    '@id': `${seoConfig.url}/#app`,
    name: 'Too Fresh To Waste',
    operatingSystem: 'Android, iOS',
    applicationCategory: 'FoodApplication',
    description: localeMetadata.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TND',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
      bestRating: '5',
      worstRating: '1',
    },
    downloadUrl: [seoConfig.appLinks.ios, seoConfig.appLinks.android],
    installUrl: [seoConfig.appLinks.ios, seoConfig.appLinks.android],
    screenshot: `${seoConfig.url}/images/app-screenshot.jpg`,
    softwareVersion: '1.0.0',
    availableLanguage: ['fr', 'ar', 'en'],
    author: {
      '@id': `${seoConfig.url}/#organization`,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Tunisia',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

