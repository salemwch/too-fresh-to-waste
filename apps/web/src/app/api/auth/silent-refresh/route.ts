import { type NextRequest, NextResponse } from 'next/server';

import { defaultLocale, isValidLocale } from '@/i18n/config';

// Resolve the direct backend URL for server-to-server calls.
// BACKEND_INTERNAL_URL takes priority (useful when NEXT_PUBLIC_API_URL is a
// Vercel proxy relative path like /api/v1 that is meaningless server-side).
// Falls back to NEXT_PUBLIC_API_URL when it is an absolute URL, then to the
// local dev default.
const rawApiUrl =
  process.env['BACKEND_INTERNAL_URL'] ??
  process.env['NEXT_PUBLIC_API_URL'] ??
  'http://localhost:3000/api/v1';

const BACKEND_API_URL = rawApiUrl.startsWith('http') ? rawApiUrl : 'http://localhost:3000/api/v1';

/**
 * GET /api/auth/silent-refresh?redirect=<encoded-path>
 *
 * Called by the middleware when the access token is expired but a refresh
 * token cookie is present. Transparently refreshes the session and redirects
 * the user to their original destination — they never see the login page.
 *
 * Security notes:
 * - The redirect param is validated to prevent open-redirect attacks.
 * - The browser's Cookie header (which includes __Host-refresh_token in prod)
 *   is forwarded verbatim to the backend refresh endpoint.
 * - New Set-Cookie headers from the backend are forwarded to the browser so
 *   the fresh access_token is available for the next middleware check.
 * - Any failure (expired refresh, network error) falls back to a login redirect
 *   with the original destination preserved as callbackUrl.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawRedirect = searchParams.get('redirect') ?? '';

  // Validate: must be a relative path starting with / (not //) — blocks open redirects.
  const redirectPath =
    rawRedirect && /^\/(?!\/)/.test(decodeURIComponent(rawRedirect))
      ? decodeURIComponent(rawRedirect)
      : `/${defaultLocale}`;

  // Extract locale from the redirect path for the fallback login URL.
  const firstSegment = redirectPath.split('/')[1] ?? '';
  const locale = isValidLocale(firstSegment) ? firstSegment : defaultLocale;

  // Forward ALL browser cookies to the backend. In production the
  // __Host-refresh_token cookie has path=/ so it IS present here.
  const cookieHeader = request.headers.get('cookie') ?? '';

  try {
    const refreshRes = await fetch(`${BACKEND_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
    });

    if (!refreshRes.ok) {
      // Refresh token was rejected (expired or revoked) — require full login.
      const callbackUrl = encodeURIComponent(redirectPath);
      return NextResponse.redirect(
        new URL(`/${locale}/login?callbackUrl=${callbackUrl}`, request.url),
      );
    }

    // Refresh succeeded — redirect the browser to its original destination.
    // The redirect triggers a fresh middleware check, which will now see the
    // valid access_token cookie and allow access.
    const response = NextResponse.redirect(new URL(redirectPath, request.url));

    // Forward the new Set-Cookie headers (fresh access_token + refresh_token)
    // from the backend response to the browser.
    for (const cookie of refreshRes.headers.getSetCookie()) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch {
    // Network or server error — do not show an error page; fall back to login
    // so the user can always reach their destination after authentication.
    const callbackUrl = encodeURIComponent(redirectPath);
    return NextResponse.redirect(
      new URL(`/${locale}/login?callbackUrl=${callbackUrl}`, request.url),
    );
  }
}
