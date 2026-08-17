import type { Locale } from '@/i18n/config';

/**
 * Slug + display name only, for the footer's city links.
 *
 * The Footer is a client component. Importing `content/locations.ts` there
 * would ship every city's intro, local-context and FAQ prose — roughly 25 KB of
 * copy that nothing on the page renders — into the JS bundle of every route
 * that shows a footer. This module carries just what the links need.
 *
 * `city-nav.test.ts` asserts this list matches `cities` exactly, so the two
 * cannot drift even though they are separate modules.
 */
export interface CityNavItem {
  slug: string;
  label: Record<Locale, string>;
}

export const cityNav: readonly CityNavItem[] = [
  { slug: 'tunis', label: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' } },
  { slug: 'sousse', label: { en: 'Sousse', fr: 'Sousse', ar: 'سوسة' } },
  { slug: 'sfax', label: { en: 'Sfax', fr: 'Sfax', ar: 'صفاقس' } },
  { slug: 'monastir', label: { en: 'Monastir', fr: 'Monastir', ar: 'المنستير' } },
  { slug: 'hammamet', label: { en: 'Hammamet', fr: 'Hammamet', ar: 'الحمامات' } },
  { slug: 'bizerte', label: { en: 'Bizerte', fr: 'Bizerte', ar: 'بنزرت' } },
  { slug: 'nabeul', label: { en: 'Nabeul', fr: 'Nabeul', ar: 'نابل' } },
] as const;
