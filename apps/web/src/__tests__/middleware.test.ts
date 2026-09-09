/**
 * @jest-environment node
 */

/**
 * Middleware contract tests.
 *
 * Written against Next 15 *before* the Next 16 upgrade, deliberately: a test
 * written afterwards only captures post-upgrade behaviour and proves nothing
 * about what was preserved. These have to pass on both sides.
 *
 * The JWTs here are signed with the real `jose`, not a mocked verifier. The
 * whole point of this middleware is that it does Edge-compatible crypto, and a
 * suite that mocks `jwtVerify` would still pass if the verification broke
 * entirely - which is exactly the failure the Next 16 runtime change could
 * cause. Only `next-intl/middleware` is stubbed, because its own behaviour is
 * not what is under test here.
 */
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';

// next-intl's middleware is a separate concern; stub it to a pass-through so
// the assertions below are about auth, redirects and locale only.
jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: () => () => NextResponse.next(),
}));

/** Sign a token the way the NestJS backend does: `sub` + `role`. */
async function signToken(
  claims: Record<string, unknown>,
  { expiresIn = '1h', secret = JWT_SECRET }: { expiresIn?: string; secret?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

function requestFor(path: string, cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(new URL(path, 'https://example.test'));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

/** Import fresh so each test picks up the current process.env. */
async function runMiddleware(request: NextRequest): Promise<Response> {
  const mod = (await import('../middleware')) as {
    default: (req: NextRequest) => Promise<Response>;
  };
  return mod.default(request);
}

function locationOf(response: Response): string {
  return response.headers.get('location') ?? '';
}

describe('middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, JWT_SECRET, NODE_ENV: 'test' } as NodeJS.ProcessEnv;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── Unauthenticated access to protected routes ────────────────────────────
  describe('unauthenticated access', () => {
    it.each([
      ['/en/merchant/dashboard', 'en'],
      ['/fr/merchant/offers', 'fr'],
      ['/ar/admin/users', 'ar'],
    ])('redirects %s to the login page for that locale', async (path, locale) => {
      const response = await runMiddleware(requestFor(path));

      expect(response.status).toBe(307);
      expect(locationOf(response)).toContain(`/${locale}/login`);
    });

    it('preserves the attempted path as callbackUrl so login can return there', async () => {
      const response = await runMiddleware(requestFor('/en/merchant/offers'));

      expect(locationOf(response)).toContain(
        `callbackUrl=${encodeURIComponent('/en/merchant/offers')}`,
      );
    });

    it('tries a silent refresh instead of login when a refresh token is present', async () => {
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { refresh_token: 'opaque-refresh-token' }),
      );

      expect(locationOf(response)).toContain('/api/auth/silent-refresh');
      expect(locationOf(response)).toContain(
        `redirect=${encodeURIComponent('/en/merchant/dashboard')}`,
      );
    });

    it('leaves public marketing routes alone', async () => {
      const response = await runMiddleware(requestFor('/en/consumer'));

      // Passes through to next-intl rather than redirecting to login.
      expect(response.headers.get('location')).toBeNull();
    });
  });

  // ── Authenticated access and role-based routing ───────────────────────────
  describe('authenticated access', () => {
    it('lets a merchant reach a merchant route', async () => {
      const token = await signToken({ sub: 'user-1', role: 'merchant' });
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(response.headers.get('location')).toBeNull();
    });

    it.each([
      ['merchant', '/en/merchant/dashboard'],
      ['location_manager', '/en/merchant/dashboard'],
      ['admin', '/en/admin/dashboard'],
      ['moderator', '/en/admin/dashboard'],
    ])('sends a signed-in %s from the root to their dashboard', async (role, expected) => {
      const token = await signToken({ sub: 'user-1', role });
      const response = await runMiddleware(requestFor('/en', { access_token: token }));

      expect(locationOf(response)).toContain(expected);
    });

    it('leaves a consumer on the root - only staff roles are redirected', async () => {
      const token = await signToken({ sub: 'user-1', role: 'consumer' });
      const response = await runMiddleware(requestFor('/en', { access_token: token }));

      expect(response.headers.get('location')).toBeNull();
    });

    it('redirects a signed-in merchant away from the login page', async () => {
      const token = await signToken({ sub: 'user-1', role: 'merchant' });
      const response = await runMiddleware(requestFor('/en/login', { access_token: token }));

      expect(locationOf(response)).toContain('/en/merchant/dashboard');
    });
  });

  // ── Token validity: every one of these must fail closed ───────────────────
  describe('invalid sessions are treated as unauthenticated', () => {
    it('rejects an expired token', async () => {
      const token = await signToken({ sub: 'user-1', role: 'merchant' }, { expiresIn: '-1h' });
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });

    it('rejects a token signed with the wrong secret', async () => {
      const token = await signToken(
        { sub: 'user-1', role: 'merchant' },
        { secret: 'a-completely-different-secret-value-here' },
      );
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });

    it('rejects a malformed token', async () => {
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: 'not-a-jwt' }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });

    it('rejects a token carrying no role', async () => {
      const token = await signToken({ sub: 'user-1' });
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });

    it('rejects a token carrying no subject', async () => {
      const token = await signToken({ role: 'merchant' });
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });

    /*
     * Security: a missing JWT_SECRET must deny, never allow. If this ever
     * inverts, a misconfigured deploy would hand every protected route to
     * anonymous traffic - the worst possible direction for this bug.
     */
    it('denies access when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;

      const token = await signToken({ sub: 'user-1', role: 'merchant' });
      const response = await runMiddleware(
        requestFor('/en/merchant/dashboard', { access_token: token }),
      );

      expect(locationOf(response)).toContain('/en/login');
    });
  });

  // ── Locale handling ───────────────────────────────────────────────────────
  describe('locale handling', () => {
    it.each(['en', 'fr', 'ar'])(
      'redirects an unprefixed path to the %s locale cookie preference',
      async locale => {
        const response = await runMiddleware(requestFor('/consumer', { NEXT_LOCALE: locale }));

        expect(response.status).toBe(307);
        expect(locationOf(response)).toContain(`/${locale}/consumer`);
      },
    );

    it('ignores an unrecognised locale cookie rather than redirecting to it', async () => {
      const response = await runMiddleware(requestFor('/consumer', { NEXT_LOCALE: 'zz' }));

      expect(locationOf(response)).not.toContain('/zz/');
    });

    it('preserves query parameters when redirecting to the cookie locale', async () => {
      const response = await runMiddleware(
        requestFor('/consumer?ref=newsletter', { NEXT_LOCALE: 'fr' }),
      );

      expect(locationOf(response)).toContain('ref=newsletter');
    });

    it('writes the locale cookie back with Lax same-site and a one-year max-age', async () => {
      const response = await runMiddleware(requestFor('/fr/consumer'));

      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('NEXT_LOCALE=fr');
      expect(setCookie.toLowerCase()).toContain('samesite=lax');
      expect(setCookie).toContain('Max-Age=31536000');
      expect(setCookie).toContain('Path=/');
    });
  });
});
