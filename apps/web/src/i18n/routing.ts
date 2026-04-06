import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  // All supported locales
  locales,

  // Default locale (English)
  defaultLocale,

  // URL strategy: '/en/about', '/fr/about', '/ar/about'
  // Always show locale prefix for clarity and persistence
  localePrefix: 'always',

  // Alternate links for SEO (hreflang)
  alternateLinks: true,

  // Enable automatic locale detection from cookie
  // This allows language preference to persist across navigation
  localeDetection: true,
});

// Navigation helpers with locale awareness
export const { Link, usePathname, useRouter } = createNavigation(routing);
