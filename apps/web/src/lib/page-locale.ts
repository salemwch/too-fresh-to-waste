import { defaultLocale, locales, type Locale } from '@/i18n/config';

/**
 * The locale of the page the user is on, from `<html lang>` (set by
 * `app/[locale]/layout.tsx`).
 *
 * Sent to the API as `Accept-Language` so backend errors come back in the
 * user's language. The browser's own header is not enough: it is the browser's
 * language, not the `/fr/...` or `/ar/...` the user chose on this site.
 */
export function currentPageLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  const lang = document.documentElement.lang;
  return (locales as readonly string[]).includes(lang) ? (lang as Locale) : defaultLocale;
}
