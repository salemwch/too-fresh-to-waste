import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { defaultLocale, type Locale, isValidLocale } from './i18n/config';

// Cookie name for storing user's locale preference
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

// Non-sensitive presence flag set by the frontend after login.
// Value is the user's role (e.g. "merchant", "admin") or "1" as fallback.
// The actual auth tokens are HttpOnly cookies managed by the backend.
const AUTH_FLAG_COOKIE = 'wfa_authenticated';

// Routes that require authentication (checked at middleware level via cookie presence)
const PROTECTED_PATH_PATTERNS = ['/merchant/', '/admin/'];

// Create the next-intl middleware with custom locale detection
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;

  // Check if pathname already has a locale prefix
  const pathnameHasLocale = routing.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
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
  const pathWithoutLocale = pathnameHasLocale
    ? pathname.replace(/^\/[a-z]{2}/, '')
    : pathname;

  // ── Read auth presence flag ────────────────────────────────────────────────
  // This is a lightweight, non-sensitive cookie (value = role or "1").
  // Real authorization is enforced server-side by NestJS guards.
  const authFlagValue = request.cookies.get(AUTH_FLAG_COOKIE)?.value;
  const isAuthenticated = !!authFlagValue;
  const role = authFlagValue && authFlagValue !== '1' ? authFlagValue : null;

  // Auto-redirect authenticated users from public root to their dashboard.
  const isRootPath = pathWithoutLocale === '/' || pathWithoutLocale === '';
  if (isRootPath && isAuthenticated && role) {
    const locale = pathnameHasLocale
      ? pathname.split('/')[1] ?? defaultLocale
      : defaultLocale;
    if (role === 'merchant') {
      return NextResponse.redirect(new URL(`/${locale}/merchant/dashboard`, request.url));
    }
    if (role === 'admin' || role === 'moderator') {
      return NextResponse.redirect(new URL(`/${locale}/admin/dashboard`, request.url));
    }
  }

  // Redirect authenticated users away from login/register pages
  const isAuthPage = pathWithoutLocale.startsWith('/login') || pathWithoutLocale.startsWith('/register');
  if (isAuthPage && isAuthenticated && role) {
    const locale = pathnameHasLocale
      ? pathname.split('/')[1] ?? defaultLocale
      : defaultLocale;
    if (role === 'merchant') {
      return NextResponse.redirect(new URL(`/${locale}/merchant/dashboard`, request.url));
    }
    if (role === 'admin' || role === 'moderator') {
      return NextResponse.redirect(new URL(`/${locale}/admin/dashboard`, request.url));
    }
  }

  // Auth protection: check if the path requires authentication
  const isProtectedRoute = PROTECTED_PATH_PATTERNS.some((pattern) =>
    pathWithoutLocale.startsWith(pattern)
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
    const loginUrl = new URL(
      `/${currentLocale}/login?callbackUrl=${callbackUrl}`,
      request.url
    );
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
