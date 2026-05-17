import type { Locale } from '@/i18n/config';

// Tunisia-focused SEO Configuration
// Supports: French (primary), Arabic, English

export const seoConfig = {
  // Base URLs
  url: process.env['NEXT_PUBLIC_SITE_URL'] || 'https://toofreshwaste.tn',
  siteName: 'Too Fresh To Waste Tunisia',

  // Localization
  defaultLocale: 'fr' as Locale,
  locales: ['fr', 'ar', 'en'] as Locale[],

  // Locale-specific metadata
  metadata: {
    fr: {
      title: 'Too Fresh To Waste - R\u00e9duisez le Gaspillage Alimentaire',
      titleTemplate: '%s | Too Fresh To Waste Tunisie',
      description:
        "Connectez-vous aux restaurants locaux en Tunisie pour sauver la nourriture en surplus. \u00c9conomisez jusqu'\u00e0 70% tout en luttant contre le gaspillage alimentaire.",
      keywords:
        'gaspillage alimentaire tunisie, nourriture pas cher tunis, resto surplus, anti gaspillage, livraison nourriture tunisie, repas \u00e0 petit prix, \u00e9conomiser nourriture',
      locale: 'fr_TN',
      ogLocale: 'fr_TN',
    },
    ar: {
      title:
        'Too Fresh To Waste - \u0642\u0644\u0644 \u0647\u062f\u0631 \u0627\u0644\u0637\u0639\u0627\u0645',
      titleTemplate: '%s | Too Fresh To Waste \u062a\u0648\u0646\u0633',
      description:
        '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0641\u064a \u062a\u0648\u0646\u0633 \u0644\u0625\u0646\u0642\u0627\u0630 \u0627\u0644\u0637\u0639\u0627\u0645 \u0627\u0644\u0641\u0627\u0626\u0636. \u0648\u0641\u0631 \u062d\u062a\u0649 70% \u0648\u0633\u0627\u0647\u0645 \u0641\u064a \u0645\u0643\u0627\u0641\u062d\u0629 \u0647\u062f\u0631 \u0627\u0644\u0637\u0639\u0627\u0645.',
      keywords:
        '\u0647\u062f\u0631 \u0627\u0644\u0637\u0639\u0627\u0645 \u062a\u0648\u0646\u0633, \u0637\u0639\u0627\u0645 \u0631\u062e\u064a\u0635 \u062a\u0648\u0646\u0633, \u062a\u0648\u0635\u064a\u0644 \u0637\u0639\u0627\u0645, \u0648\u062c\u0628\u0627\u062a \u0628\u0623\u0633\u0639\u0627\u0631 \u0645\u0646\u062e\u0641\u0636\u0629, \u062a\u0637\u0628\u064a\u0642 \u0637\u0639\u0627\u0645 \u062a\u0648\u0646\u0633',
      locale: 'ar_TN',
      ogLocale: 'ar_TN',
    },
    en: {
      title: 'Too Fresh To Waste - Reduce Food Waste, Save Money',
      titleTemplate: '%s | Too Fresh To Waste Tunisia',
      description:
        'Connect with local restaurants in Tunisia to rescue surplus food. Save up to 70% while fighting food waste.',
      keywords:
        'food waste tunisia, cheap food tunis, surplus food, food delivery tunisia, discount meals, save money on food',
      locale: 'en',
      ogLocale: 'en_US',
    },
  } as const,

  // Social sharing images (replace hero-bg.jpg with a branded 1200×630 OG image when ready)
  ogImage: '/images/hero-bg.jpg',
  ogImageAlt: {
    fr: 'Too Fresh To Waste - R\u00e9duisez le gaspillage alimentaire en Tunisie',
    ar: 'Too Fresh To Waste - \u0642\u0644\u0644 \u0647\u062f\u0631 \u0627\u0644\u0637\u0639\u0627\u0645 \u0641\u064a \u062a\u0648\u0646\u0633',
    en: 'Too Fresh To Waste - Reduce food waste in Tunisia',
  },

  // Twitter
  twitterCard: 'summary_large_image' as const,
  twitterHandle: '@toofreshwaste_tn',

  // Contact - Tunisia (set via env vars or override per-environment)
  email: process.env['NEXT_PUBLIC_CONTACT_EMAIL'] || 'contact@toofreshwaste.tn',
  phone: process.env['NEXT_PUBLIC_BUSINESS_PHONE'] || '',
  whatsapp: process.env['NEXT_PUBLIC_BUSINESS_WHATSAPP'] || '',

  // Social media — full URLs centralised here; consumed by Footer, SEO, etc.
  social: {
    facebook: 'toofreshwastetunisie',
    instagram: 'toofreshwaste_tn',
    linkedin: 'company/too-fresh-to-waste-tunisia',
    tiktok: '@toofreshwaste_tn',
  },
  socialUrls: {
    facebook:
      process.env['NEXT_PUBLIC_SOCIAL_FACEBOOK'] ||
      'https://www.facebook.com/profile.php?id=61585767061906',
    instagram:
      process.env['NEXT_PUBLIC_SOCIAL_INSTAGRAM'] ||
      'https://www.instagram.com/toofreshtowaste.tn/',
    x: process.env['NEXT_PUBLIC_SOCIAL_X'] || 'https://x.com/TooFresh2Waste',
    linkedin:
      process.env['NEXT_PUBLIC_SOCIAL_LINKEDIN'] ||
      'https://www.linkedin.com/company/too-fresh-to-waste/',
  },
  // Creator attribution
  creatorUrl:
    process.env['NEXT_PUBLIC_CREATOR_URL'] || 'https://www.linkedin.com/in/salem-wachwacha-h/',

  // Business info for structured data
  business: {
    name: 'Too Fresh To Waste Tunisia',
    legalName: 'Too Fresh To Waste SARL',
    foundingDate: '2024',
    founder: 'Too Fresh To Waste Team',
    description: {
      fr: "Premi\u00e8re application anti-gaspillage alimentaire en Tunisie. Connectez-vous aux restaurants locaux pour sauver la nourriture et \u00e9conomiser jusqu'\u00e0 70%.",
      ar: '\u0623\u0648\u0644 \u062a\u0637\u0628\u064a\u0642 \u0644\u0645\u0643\u0627\u0641\u062d\u0629 \u0647\u062f\u0631 \u0627\u0644\u0637\u0639\u0627\u0645 \u0641\u064a \u062a\u0648\u0646\u0633. \u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0644\u0625\u0646\u0642\u0627\u0630 \u0627\u0644\u0637\u0639\u0627\u0645 \u0648\u0648\u0641\u0631 \u062d\u062a\u0649 70%.',
      en: "Tunisia's first anti-food waste app. Connect with local restaurants to save food and save up to 70%.",
    },
    address: {
      streetAddress: process.env['NEXT_PUBLIC_BUSINESS_ADDRESS'] || '',
      addressLocality: 'Tunis',
      addressRegion: 'Tunis',
      postalCode: '1000',
      addressCountry: 'TN',
    },
    geo: {
      latitude: 36.8065,
      longitude: 10.1815,
    },
    // Service areas in Tunisia
    serviceAreas: [
      {
        name: 'Tunis',
        nameAr: '\u062a\u0648\u0646\u0633',
        coordinates: { lat: 36.8065, lng: 10.1815 },
      },
      {
        name: 'Sousse',
        nameAr: '\u0633\u0648\u0633\u0629',
        coordinates: { lat: 35.8288, lng: 10.6405 },
      },
      {
        name: 'Sfax',
        nameAr: '\u0635\u0641\u0627\u0642\u0633',
        coordinates: { lat: 34.7406, lng: 10.7603 },
      },
      {
        name: 'Monastir',
        nameAr: '\u0627\u0644\u0645\u0646\u0633\u062a\u064a\u0631',
        coordinates: { lat: 35.7643, lng: 10.8113 },
      },
      {
        name: 'Hammamet',
        nameAr: '\u0627\u0644\u062d\u0645\u0627\u0645\u0627\u062a',
        coordinates: { lat: 36.4, lng: 10.6167 },
      },
      {
        name: 'Bizerte',
        nameAr: '\u0628\u0646\u0632\u0631\u062a',
        coordinates: { lat: 37.2744, lng: 9.8739 },
      },
      {
        name: 'Nabeul',
        nameAr: '\u0646\u0627\u0628\u0644',
        coordinates: { lat: 36.4561, lng: 10.7376 },
      },
    ],
    // Operating hours
    openingHours: 'Mo-Su 08:00-23:00',
    priceRange: 'TND',
  },

  // App store links (set via env vars — placeholder IDs must be replaced before launch)
  appLinks: {
    ios: process.env['NEXT_PUBLIC_APP_STORE_URL'] || '',
    android: process.env['NEXT_PUBLIC_PLAY_STORE_URL'] || '',
  },

  // Verification codes (set via environment variables)
  verification: {
    google: process.env['NEXT_PUBLIC_GOOGLE_VERIFICATION'],
    bing: process.env['NEXT_PUBLIC_BING_VERIFICATION'],
    facebook: process.env['NEXT_PUBLIC_FACEBOOK_VERIFICATION'],
  },
} as const;

// Helper function to get locale-specific SEO metadata
export function getLocaleSeoMetadata(locale: Locale) {
  return seoConfig.metadata[locale] || seoConfig.metadata[seoConfig.defaultLocale];
}

// Helper to get full URL with locale
export function getCanonicalUrl(path: string, locale: Locale): string {
  const baseUrl = seoConfig.url;
  const localePath = locale === seoConfig.defaultLocale ? '' : `/${locale}`;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${localePath}${cleanPath === '/' ? '' : cleanPath}`;
}
