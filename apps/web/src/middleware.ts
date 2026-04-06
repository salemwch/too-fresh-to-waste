import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { routing } from './i18n/routing';
import { defaultLocale, type Locale, isValidLocale } from './i18n/config';

// Cookie name for storing user's locale preference
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

// Routes that require authentication (checked at middleware level via JWT verification)
const PROTECTED_PATH_PATTERNS = ['/merchant/', '/admin/'];

// Create the next-intl middleware with custom locale detection
const intlMiddleware = createMiddleware(routing);

/**
 * Verify the access_token HttpOnly cookie using jose (Edge Runtime compatible).
 * Returns the JWT payload on success, or null if missing/invalid/expired.
 *
 * The access_token cookie is set by the NestJS backend with HttpOnly + SameSite=Lax.
 * Next.js middleware runs server-side, so it CAN read HttpOnly cookies from the
 * incoming request — no client-side JavaScript is involved.
 */
async function verifySession(
  request: NextRequest,
): Promise<{ role: string; userId: string } | null> {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[middleware] JWT_SECRET is not set — falling back to unauthenticated. ' +
          'Add JWT_SECRET to apps/web/.env.local (same value as the backend).',
      );
    }
    return null;
  }

  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    // NestJS JWT uses `sub` for userId, `role` for role
    const userId = (payload.sub ?? payload['userId']) as string | undefined;
    const role = payload['role'] as string | undefined;
    if (!userId || !role) return null;
    return { role, userId };
  } catch {
    // Token expired, signature mismatch, malformed — treat as unauthenticated
    return null;
  }
}

export default async function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;

  // Check if pathname already has a locale prefix
  const pathnameHasLocale = routing.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  // If no locale in pathname, check cookie for user preference
  if (!pathnameHasLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;

    // If cookie exists and is valid, redirect to that locale (preserving query params)
    if (cookieLocale && isValidLocale(cookieLocale)) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = `/${cookieLocale}${pathname}`;
      return NextResponse.redirect(newUrl);
    }
  }

  // Strip locale prefix for route matching
  const pathWithoutLocale = pathnameHasLocale ? pathname.replace(/^\/[a-z]{2}/, '') : pathname;

  // ── Verify JWT from HttpOnly cookie (server-side, jose) ──────────────────
  // This replaces the insecure wfa_authenticated flag cookie with real JWT
  // signature verification at the Edge. The access_token cookie is HttpOnly,
  // so it is never accessible to client-side JavaScript.
  const session = await verifySession(request);
  const isAuthenticated = !!session;
  const role = session?.role ?? null;

  // Auto-redirect authenticated users from public root to their dashboard.
  const isRootPath = pathWithoutLocale === '/' || pathWithoutLocale === '';
  if (isRootPath && isAuthenticated && role) {
    const locale = pathnameHasLocale ? (pathname.split('/')[1] ?? defaultLocale) : defaultLocale;
    if (role === 'merchant') {
      return NextResponse.redirect(new URL(`/${locale}/merchant/dashboard`, request.url));
    }
    if (role === 'admin' || role === 'moderator') {
      return NextResponse.redirect(new URL(`/${locale}/admin/dashboard`, request.url));
    }
  }

  // Redirect authenticated users away from login/register pages
  const isAuthPage =
    pathWithoutLocale.startsWith('/login') || pathWithoutLocale.startsWith('/register');
  if (isAuthPage && isAuthenticated && role) {
    const locale = pathnameHasLocale ? (pathname.split('/')[1] ?? defaultLocale) : defaultLocale;
    if (role === 'merchant') {
      return NextResponse.redirect(new URL(`/${locale}/merchant/dashboard`, request.url));
    }
    if (role === 'admin' || role === 'moderator') {
      return NextResponse.redirect(new URL(`/${locale}/admin/dashboard`, request.url));
    }
  }

  // Auth protection: check if the path requires authentication
  const isProtectedRoute = PROTECTED_PATH_PATTERNS.some((pattern) =>
    pathWithoutLocale.startsWith(pattern),
  );

  if (isProtectedRoute && !isAuthenticated) {
    // Extract current locale from pathname
    let currentLocale: Locale = defaultLocale;
    if (pathnameHasLocale) {
      const localePrefix = pathname.split('/')[1];
      if (localePrefix && isValidLocale(localePrefix)) {
        currentLocale = localePrefix as Locale;
      }
    }

    // Redirect to login with callbackUrl
    const callbackUrl = encodeURIComponent(pathname);
    const loginUrl = new URL(`/${currentLocale}/login?callbackUrl=${callbackUrl}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Run the next-intl middleware
  const response = intlMiddleware(request);

  // Extract locale from the response or pathname
  let currentLocale: Locale = defaultLocale;

  if (pathnameHasLocale) {
    const localePrefix = pathname.split('/')[1];
    if (localePrefix && isValidLocale(localePrefix)) {
      currentLocale = localePrefix as Locale;
    }
  }

  // Ensure cookie is set to current locale
  if (response) {
    response.cookies.set(LOCALE_COOKIE_NAME, currentLocale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  // Match all pathnames except for:
  // - API routes
  // - Static files
  // - Internal Next.js paths
  matcher: [
    // Match all pathnames except for static files
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Match root
    '/',
  ],
};
