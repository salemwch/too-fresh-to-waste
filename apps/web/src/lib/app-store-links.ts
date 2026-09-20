/**
 * Where the "Download the app" buttons point.
 *
 * ## Why this is one module
 *
 * Nineteen download buttons across the header, footer and four marketing pages
 * all opened a "coming soon" modal, because there was nothing to link to yet.
 * The day the app is published that has to become a real link in nineteen
 * places at once, and any one that is missed keeps telling visitors the app is
 * not out.
 *
 * So the decision lives here and nowhere else: a button links when a store URL
 * is configured and falls back to the launch modal when it is not. Publishing
 * is then a Vercel environment-variable change and a redeploy, with no code
 * edit and nothing to miss.
 *
 * ## The two platforms are independent on purpose
 *
 * Android and iOS resolve separately. This app ships Android only - iOS builds
 * need a macOS runner with Xcode (see CLAUDE.md) - so setting
 * `NEXT_PUBLIC_PLAY_STORE_URL` alone is the expected launch state: Google Play
 * buttons become links, App Store buttons keep opening the modal, and nobody is
 * sent to a 404 on the App Store.
 *
 * ## `process.env` is read with literal keys, deliberately
 *
 * Next.js inlines `NEXT_PUBLIC_*` into the client bundle at build time by
 * textually substituting `process.env.NEXT_PUBLIC_FOO`. A dynamic lookup -
 * `process.env[key]` - is not substituted and evaluates to `undefined` in the
 * browser, so the buttons would silently stay on the modal in production while
 * working in `next dev`. The literal reads below are what make this work.
 */

export type AppPlatform = 'android' | 'ios';

/**
 * Raw values, read once at module scope with literal keys so the Next.js build
 * can inline them. Empty or unset means "not published yet".
 */
const RAW_STORE_URLS: Record<AppPlatform, string | undefined> = {
  android: process.env['NEXT_PUBLIC_PLAY_STORE_URL'],
  ios: process.env['NEXT_PUBLIC_APP_STORE_URL'],
};

/**
 * Only ever link somewhere a store actually lives.
 *
 * A mistyped environment variable would otherwise become a live anchor on the
 * homepage pointing at whatever was pasted in. Restricting to https on the two
 * known store hosts means a bad value degrades to the launch modal - the same
 * behaviour as not setting it - rather than to a broken link.
 */
const ALLOWED_STORE_HOSTS: Record<AppPlatform, readonly string[]> = {
  android: ['play.google.com'],
  ios: ['apps.apple.com', 'itunes.apple.com'],
};

function resolve(platform: AppPlatform): string | null {
  const raw = RAW_STORE_URLS[platform]?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!ALLOWED_STORE_HOSTS[platform].includes(url.hostname)) return null;

  return url.toString();
}

/**
 * Resolved once per platform. These are build-time constants, so there is
 * nothing to recompute per render.
 */
const STORE_URLS: Record<AppPlatform, string | null> = {
  android: resolve('android'),
  ios: resolve('ios'),
};

/** The store URL for a platform, or `null` when it is not published yet. */
export function getStoreUrl(platform: AppPlatform): string | null {
  return STORE_URLS[platform];
}

/**
 * Where a button with no specific platform should go.
 *
 * Android is the only platform this app ships, so a generic "Download the app"
 * CTA resolves there. It returns `null` - and the caller falls back to the
 * launch modal - until Android is published.
 *
 * This deliberately does not sniff the user agent. Choosing the link from
 * `navigator.userAgent` differs between the server and client renders, which is
 * a hydration mismatch; and with no iOS build to send anyone to, the only thing
 * UA detection could add today is a wrong answer.
 */
export function getPrimaryStoreUrl(): string | null {
  return STORE_URLS.android;
}
