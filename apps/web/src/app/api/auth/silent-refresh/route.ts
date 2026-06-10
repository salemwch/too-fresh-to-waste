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

const BACKEND_API_URL = rawApiUrl.startsWith('http')
  ? rawApiUrl
  : `${process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3000'}/api/v1`;

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
    // Network or server error — backend unreachable but the refresh token
    // cookie is still valid. Instead of sending the user to /login (which
    // implies their session is dead), serve a minimal retry page that
    // auto-reloads after 3 seconds. Once the backend recovers, the redirect
    // will succeed transparently — the user never sees a login form.
    return new NextResponse(
      `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reconnecting…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa;color:#333}
.c{text-align:center}.sp{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#1E4448;border-radius:50%;animation:s .8s linear infinite;margin:0 auto 16px}
@keyframes s{to{transform:rotate(360deg)}}</style>
<meta http-equiv="refresh" content="3;url=${encodeURI(request.url)}">
</head><body><div class="c"><div class="sp"></div><p>Reconnecting to server…</p></div></body></html>`,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': '3',
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
