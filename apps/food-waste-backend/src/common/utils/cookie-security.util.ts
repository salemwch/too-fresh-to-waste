import type { Response } from 'express';

/**
 * Environment-aware cookie names.
 *
 * In production the __Host- prefix is enforced by the browser itself:
 *   • secure: true  — browser silently drops the cookie if false
 *   • path: /       — browser silently drops the cookie if not root
 *   • domain: omit  — browser silently drops the cookie if domain is present
 * This prevents subdomain cookie theft at the browser level, not just by policy.
 *
 * In development (HTTP) __Host- is not usable (requires HTTPS), so we fall
 * back to plain names. Dev tokens are not production secrets, so this is safe.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes
 */
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: IS_PRODUCTION ? '__Host-access_token' : 'access_token',
  REFRESH_TOKEN: IS_PRODUCTION ? '__Host-refresh_token' : 'refresh_token',
  SESSION_ID: IS_PRODUCTION ? '__Host-session_id' : 'session_id',
  // CSRF token intentionally has no __Host- prefix: it must be readable by JS
  // (double-submit cookie pattern). __Secure- would work but adds no value here
  // since SameSite=Lax + HMAC-SHA256 verification already prevents CSRF.
  CSRF_TOKEN: 'csrf-token',
} as const;

export interface SecureCookieOptions {
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: 'strict' | 'lax' | 'none' | undefined;
  maxAge?: number | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  signed?: boolean | undefined;
}

export class CookieSecurityUtil {
  private static normalizeDomain(domain?: string): string | undefined {
    if (domain === null || domain === undefined) {
      return undefined;
    }
    const trimmed = domain.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Build cookie options with mandatory security attributes.
   *
   * Production (__Host- mode):
   *   - secure: true (always — required by prefix)
   *   - path: /      (always — required by prefix; customOptions.path ignored)
   *   - domain: omit (always — required by prefix; domain param ignored)
   *
   * Development:
   *   - secure: false (HTTP-only local dev)
   *   - domain/path: from params
   */
  static getSecureOptions(
    isProduction: boolean,
    domain?: string,
    customOptions?: Partial<SecureCookieOptions>,
  ): SecureCookieOptions {
    if (isProduction) {
      // Strip domain and path from customOptions — __Host- requires path=/ and no domain.
      // Destructure to explicitly discard them; the rest of customOptions still applies.
      const { domain: _d, path: _p, ...rest } = customOptions ?? {};
      return {
        httpOnly: true,
        secure: true, // required by __Host-
        sameSite: 'lax',
        path: '/', // required by __Host-
        // domain MUST be absent for __Host- cookies
        ...rest,
      };
    }

    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      domain: this.normalizeDomain(domain),
      ...customOptions,
    };
  }

  /** Set the access token cookie (15 min, path: /). */
  static setAccessTokenCookie(
    res: Response,
    token: string,
    isProduction: boolean,
    domain?: string,
    expiresInMs: number = 15 * 60 * 1000,
  ): void {
    if (!this.isValidCookieValue(token)) {
      throw new Error('Invalid access token format for cookie');
    }

    const options = this.getSecureOptions(isProduction, domain, { maxAge: expiresInMs });
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, token, options); // nosemgrep: tftw-cookie-missing-httponly,tftw-cookie-missing-secure
  }

  /**
   * Set the refresh token cookie.
   *
   * Dev: path restricted to /api/v1/auth/refresh (minimise exposure surface).
   * Production: path forced to / by __Host- requirement. This is acceptable
   * because httpOnly:true already prevents JS access, and __Host- gives stronger
   * subdomain protection than the path restriction ever did.
   */
  static setRefreshTokenCookie(
    res: Response,
    token: string,
    isProduction: boolean,
    domain?: string,
    expiresInMs: number = 365 * 24 * 60 * 60 * 1000,
  ): void {
    if (!this.isValidCookieValue(token)) {
      throw new Error('Invalid refresh token format for cookie');
    }

    const options = this.getSecureOptions(isProduction, domain, {
      maxAge: expiresInMs,
      // Production: __Host- overrides this to '/'. Dev: kept for defence-in-depth.
      path: '/api/v1/auth/refresh',
    });

    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, token, options); // nosemgrep: tftw-cookie-missing-httponly,tftw-cookie-missing-secure
  }

  /** Clear both auth cookies on logout. Paths must match what was used when setting. */
  static clearAuthCookies(res: Response, isProduction: boolean, domain?: string): void {
    const base = this.getSecureOptions(isProduction, domain, { maxAge: 0 });

    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { ...base, path: '/' });

    // Match the path used when setting: / in production (__Host-), scoped path in dev.
    const refreshPath = isProduction ? '/' : '/api/v1/auth/refresh';
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { ...base, path: refreshPath });
  }

  /** Set the session cookie (24 h, signed). */
  static setSessionCookie(
    res: Response,
    sessionId: string,
    isProduction: boolean,
    domain?: string,
    expiresInMs: number = 24 * 60 * 60 * 1000,
  ): void {
    if (!this.isValidCookieValue(sessionId)) {
      throw new Error('Invalid session ID format for cookie');
    }

    const options = this.getSecureOptions(isProduction, domain, {
      maxAge: expiresInMs,
      signed: true,
    });

    res.cookie(COOKIE_NAMES.SESSION_ID, sessionId, options); // nosemgrep: tftw-cookie-missing-httponly,tftw-cookie-missing-secure
  }

  /** Validate a cookie value — rejects header-injection characters and oversized values. */
  static isValidCookieValue(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    if (/[\r\n\0]/.test(value)) {
      return false;
    }
    if (value.length > 4096) {
      return false;
    }
    return true;
  }

  /** Returns current security configuration for audit/monitoring. */
  static getSecurityConfig(
    isProduction: boolean,
    domain?: string,
  ): {
    cookiePrefix: string;
    securityAttributes: { httpOnly: boolean; secure: boolean; sameSite: string; domain: string };
    tokenLifetime: { accessToken: string; refreshToken: string; session: string };
    compliance: { owasp: string; level: string };
  } {
    return {
      cookiePrefix: isProduction ? '__Host-' : 'none (dev)',
      securityAttributes: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        domain: isProduction
          ? 'omitted (__Host-)'
          : (this.normalizeDomain(domain) ?? 'current-domain-only'),
      },
      tokenLifetime: {
        accessToken: '15 minutes',
        refreshToken: '365 days',
        session: '24 hours',
      },
      compliance: {
        owasp: 'OWASP Top 10 2021 — A01, A03, A05',
        level: 'RFC 6265bis __Host- prefix enforced in production',
      },
    };
  }
}

export interface SecureResponse extends Response {
  setSecureAccessToken(token: string, isProduction: boolean): void;
  setSecureRefreshToken(token: string, isProduction: boolean): void;
  clearAuthCookies(isProduction: boolean): void;
}
