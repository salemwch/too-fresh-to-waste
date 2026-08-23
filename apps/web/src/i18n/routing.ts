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

/**
 * Navigation helpers with locale awareness.
 *
 * `redirect` is exported alongside the rest because `next/navigation`'s version
 * has no idea locales exist: `redirect('/')` from `/fr/coming-soon` sends the
 * reader to the English home page. Every redirect in a locale-prefixed route
 * has to come from here.
 */
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
