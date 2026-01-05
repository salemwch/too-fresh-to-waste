import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  // All supported locales
  locales,

  // Default locale (French for Tunisia)
  defaultLocale,

  // URL strategy: '/fr/about', '/ar/about', '/en/about'
  // Default locale doesn't need prefix: '/about' = French
  localePrefix: 'as-needed',

  // Alternate links for SEO (hreflang)
  alternateLinks: true,

  // Locale detection
  localeDetection: true,
});

// Navigation helpers with locale awareness
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
