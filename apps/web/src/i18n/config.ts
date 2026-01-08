// i18n Configuration for Tunisia Market
// Supports: English (primary), French, Arabic

export const locales = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

// Locale metadata for SEO and UI
export const localeConfig: Record<Locale, {
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  hreflang: string;
  dateFormat: string;
  numberFormat: Intl.NumberFormatOptions;
  currency: string;
}> = {
  fr: {
    name: 'French',
    nativeName: 'Fran\u00e7ais',
    direction: 'ltr',
    hreflang: 'fr-TN',
    dateFormat: 'dd/MM/yyyy',
    numberFormat: { style: 'decimal', minimumFractionDigits: 2 },
    currency: 'TND',
  },
  ar: {
    name: 'Arabic',
    nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
    direction: 'rtl',
    hreflang: 'ar-TN',
    dateFormat: 'yyyy/MM/dd',
    numberFormat: { style: 'decimal', minimumFractionDigits: 2 },
    currency: 'TND',
  },
  en: {
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    hreflang: 'en',
    dateFormat: 'MM/dd/yyyy',
    numberFormat: { style: 'decimal', minimumFractionDigits: 2 },
    currency: 'TND',
  },
};

// Get locale config helper
export function getLocaleConfig(locale: Locale) {
  return localeConfig[locale] || localeConfig[defaultLocale];
}

// Check if locale is RTL
export function isRTL(locale: Locale): boolean {
  return getLocaleConfig(locale).direction === 'rtl';
}

// Validate locale
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
