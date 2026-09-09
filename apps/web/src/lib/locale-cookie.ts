import type { Locale } from '@/i18n/config';

/**
 * Name of the locale preference cookie.
 *
 * Must stay in step with `LOCALE_COOKIE_NAME` in src/middleware.ts, which reads
 * this cookie on the Edge to pick the locale for a request. next-intl also uses
 * this exact name by convention.
 */
const LOCALE_COOKIE = 'NEXT_LOCALE';

/** One year, in seconds. */
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the reader's language choice.
 *
 * Lives at module scope rather than inside the component that calls it. The
 * React Compiler treats `document` as frozen inside a component body and
 * reported the assignment as "this value cannot be modified", because it cannot
 * prove the enclosing function only ever runs from a click handler. Moving the
 * write out is also the shape already used for the theme cookie in
 * lib/theme-script.ts, so both preferences are written the same way.
 *
 * `SameSite=Lax` so the preference survives a top-level navigation back into
 * the site. `Secure` only on https, or the cookie is dropped in development.
 */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
}
