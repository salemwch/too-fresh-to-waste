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

  // Disable automatic locale detection to ensure language persistence
  // User must manually select language, which will persist across navigation
  localeDetection: false,
});

// Navigation helpers with locale awareness
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
