/**
 * Pre-paint theme application.
 *
 * The theme lives in a cookie rather than localStorage (see DESIGN.md §19-E16),
 * but the `[locale]` layout is statically generated - reading the cookie there
 * with `next/headers` would force every route to render dynamically. So the
 * class is applied by this snippet instead, injected into <head> and run
 * synchronously before first paint.
 *
 * That is the whole point: a `useEffect` in the provider runs *after* the first
 * paint, so a dark-mode user sees a white flash on every navigation. This runs
 * before the body is painted, so there is nothing to flash.
 *
 * Kept deliberately tiny and dependency-free. It is inlined into the HTML, and
 * `script-src` allows `'unsafe-inline'` (next.config.js) so it executes.
 */

const THEME_COOKIE = 'foodwaste-theme';

export type Theme = 'light' | 'dark' | 'system';

/** Serialised so it can be dropped straight into a <script> tag. */
export const themeInitScript = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/);
var t=m?decodeURIComponent(m[1]):'light';
if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
var r=document.documentElement;
r.classList.remove('light','dark');
r.classList.add(t==='dark'?'dark':'light');
}catch(e){}})();`;

/** Read the theme cookie in the browser. Returns null when unset. */
export function readThemeCookie(): Theme | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`).exec(document.cookie);
  if (!match?.[1]) return null;
  const value = decodeURIComponent(match[1]);
  return value === 'light' || value === 'dark' || value === 'system' ? value : null;
}

/**
 * Persist the theme for a year.
 *
 * `SameSite=Lax` because this is a first-party preference that must survive a
 * top-level navigation back into the site. Not `Secure` in development, where
 * the origin is plain http and the cookie would otherwise be dropped.
 */
export function writeThemeCookie(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
