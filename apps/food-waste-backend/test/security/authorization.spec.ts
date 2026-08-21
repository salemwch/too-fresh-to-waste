/**
 * Authorization matrix — the gate no static scanner can substitute for.
 *
 * Broken object-level authorization (BOLA/IDOR) is OWASP API Security #1 and
 * the single most common real-world breach. No type-checker, linter, or SAST
 * tool can find it, because none of them knows that `order.customerId` is
 * *supposed* to equal the caller. The only durable defence is an explicit,
 * enumerated statement of what every route requires — checked in CI.
 *
 * @rationale This backend registers **no `APP_GUARD`**. Authentication is
 * opt-in per route via `@UseGuards(JwtAuthGuard)`. So the failure mode is not
 * "protected by default, explicitly opened" — it is the reverse: a route that
 * forgets the decorator is silently world-readable, and nothing else in the
 * repo notices. Every assertion below exists because of that inversion.
 *
 * These tests are static: they read the decorators, not runtime behaviour.
 * That is deliberate — they run in milliseconds with no database, so they gate
 * every commit rather than a nightly job. They prove a route *declares* the
 * right protection, not that the handler enforces ownership correctly. The
 * latter needs per-endpoint integration tests; this file makes sure no route
 * reaches that stage unnoticed.
 */

import { collectRoutes, isAuthenticated, type RouteRecord } from './route-inventory';

/**
 * Every route reachable WITHOUT a valid session, with the reason it is open.
 *
 * Adding a route here is a security decision: it says "an anonymous caller on
 * the public internet may invoke this". A new unauthenticated endpoint fails
 * the suite until someone writes down why.
 *
 * Keys are `METHOD /path`. Two controllers exposing the same path share one
 * entry (e.g. `GET /` from the root and health controllers).
 */
const UNAUTHENTICATED_ROUTES: Readonly<Record<string, string>> = {
  // — Infrastructure & probes ————————————————————————————————
  'GET /': 'Root/liveness banner. No data.',
  'HEAD /': 'Uptime probe.',
  'GET /api': 'API index.',
  'GET /favicon.ico': 'Static asset.',
  'GET /health': 'Load-balancer health probe.',
  'GET /liveness': 'Kubernetes liveness probe.',
  'GET /readiness': 'Kubernetes readiness probe.',
  'POST /csp-report': 'Browser CSP violation sink. Write-only, unauthenticated by spec.',

  // — Authentication: must be reachable before a session exists ——————
  'POST /auth/login': 'Establishes the session. Throttled.',
  'POST /auth/register': 'Account creation. Throttled.',
  'POST /auth/refresh': 'Rotates tokens; authenticated by the refresh cookie, not JwtAuthGuard.',
  'POST /auth/logout': 'Must succeed even with an expired access token.',
  'POST /auth/google': 'OAuth callback; authenticated by the provider assertion.',
  'POST /auth/mfa/verify': 'Second factor — the session does not exist yet.',
  'POST /auth/forgot-password': 'Pre-session by definition. Throttled.',
  'POST /auth/reset-password': 'Authenticated by the emailed token. Throttled.',
  'POST /auth/verify-email': 'Authenticated by the emailed token.',
  'GET /auth/verify-email': 'Email-link redirect target.',
  'POST /auth/resend-verification': 'Pre-verification by definition. Throttled.',
  'GET /auth/csrf-token': 'Issues the CSRF token the login form needs.',
  'GET /auth/password-policy': 'Public policy so the client can validate before submitting.',
  'POST /auth/check-password-strength': 'Client-side strength meter. Stateless.',
  'POST /auth/generate-password': 'Password suggestion for the signup form. Stateless.',

  // — Public marketplace surface ————————————————————————————
  'GET /search/suggestions': 'Anonymous browsing — autocomplete before sign-in.',
  'POST /search': 'Anonymous search. Currently returns 501.',
  'POST /proximity-search/establishments': 'Map browsing before sign-in.',
  'POST /proximity-search/map-establishments': 'Map browsing before sign-in.',
  'GET /proximity-search/quick-search': 'Map browsing before sign-in.',
  'GET /community-goal/stats': 'Marketing figure shown on the public site.',
  'GET /donations/stats': 'Marketing figure shown on the public site.',
  'GET /donations/health': 'Donation subsystem probe.',
  'GET /config/features': 'Feature flags the client needs before sign-in.',
  'GET /config/app-version': 'Force-update check on cold start, before sign-in.',
  'POST /waitlist/subscribe': 'Pre-launch capture form.',
  'POST /enterprise/inquiry': 'Public contact form.',
  'GET /public/impact':
    'Marketing homepage totals. Aggregates only — counts, never rows. Cached as one shared entry, so it identifies nobody.',
  'GET /public/geozones':
    'The public rollout map. Per-city counts and launch status; no establishment or person is named.',
  'POST /public/waitlist':
    'City waiting-list capture on the rollout map. Anonymous by necessity — the visitor has no account in a city we have not opened. Throttled to 5/min, writes one row keyed by (email, city), and returns the same message whether or not the address was already present.',

  // — Geolocation utilities ————————————————————————————————
  // Stateless computation, no persistence, no user data. See the abuse note
  // in the resource-consumption test below.
  'GET /geolocation/bounding-box': 'Stateless geometry helper.',
  'POST /geolocation/center/calculate': 'Stateless geometry helper.',
  'POST /geolocation/distance/calculate': 'Stateless geometry helper.',
  'POST /geolocation/distances/calculate': 'Stateless geometry helper (batch).',
  'POST /geolocation/geofence/check': 'Stateless geometry helper.',
  'POST /geolocation/validate/coordinates': 'Stateless validation helper.',
  'POST /geolocation/geocode': 'Proxies the geocoding provider.',
  'POST /geolocation/reverse-geocode': 'Proxies the geocoding provider.',
  'GET /geolocation/location/autocomplete': 'Address autocomplete during signup.',
  'GET /geolocation/location/details': 'Address details during signup.',

  // — Provider callbacks ————————————————————————————————————
  // Konnect calls these server-to-server; there is no session to present and
  // Konnect's silentWebhook sends no signature. Both handlers therefore treat
  // the payload as untrusted and re-fetch authoritative state from Konnect's
  // API before crediting anything. See konnect-order.service.ts.
  'POST /subscriptions/webhook/konnect':
    'Konnect callback; payload not trusted, status re-fetched.',
};

/** Guards that enforce a role or an ownership relation, beyond authentication. */
const AUTHORIZING_GUARDS = [
  'RolesGuard',
  'AdminOnlyGuard',
  'AdminOnlyModerationGuard',
  'ModerationAccessGuard',
  'ReportOwnershipGuard',
  'ProSubscriptionGuard',
] as const;

/**
 * Routes under a privileged path prefix that are deliberately available to any
 * authenticated user. Each needs a reason — the prefix alone is not proof a
 * route is privileged.
 */
const USER_LEVEL_ROUTES_UNDER_PRIVILEGED_PATHS: Readonly<Record<string, string>> = {
  'POST /moderation/reports':
    'Any signed-in user may report content — that is the point of reporting. ' +
    'Rate-limited by ModerationReportRateLimitGuard; reading and actioning ' +
    'reports remain gated by ModerationAccessGuard.',
};

const hasAuthorizingGuard = (r: RouteRecord): boolean =>
  r.guards.some(g => (AUTHORIZING_GUARDS as readonly string[]).includes(g));

const describeRoute = (r: RouteRecord): string =>
  `${r.id}  (${r.controller}.${r.handler} — ${r.file})`;

describe('authorization matrix', () => {
  const routes = collectRoutes();

  it('finds the controller surface at all', () => {
    // Guards the inventory itself: a broken extractor would silently report
    // zero routes and every assertion below would vacuously pass.
    expect(routes.length).toBeGreaterThan(300);
    expect(new Set(routes.map(r => r.controller)).size).toBeGreaterThan(40);
  });

  describe('every route states whether it needs a session', () => {
    it('exposes no unauthenticated route that is not written down', () => {
      const undeclared = routes
        .filter(r => !isAuthenticated(r))
        .filter(r => !(r.id in UNAUTHENTICATED_ROUTES))
        .map(describeRoute);

      // A new route with no JwtAuthGuard lands here. Either add the guard, or
      // add it to UNAUTHENTICATED_ROUTES with the reason it may be anonymous.
      expect(undeclared).toEqual([]);
    });

    it('has no stale entries in the allowlist', () => {
      // Keeps the list honest: a route that gained a guard, or was deleted,
      // must leave the allowlist so it cannot silently re-open later.
      const live = new Set(routes.filter(r => !isAuthenticated(r)).map(r => r.id));
      const stale = Object.keys(UNAUTHENTICATED_ROUTES).filter(id => !live.has(id));

      expect(stale).toEqual([]);
    });
  });

  describe('privileged areas enforce more than authentication', () => {
    it('gates every /admin and /moderation route on a role or ownership guard', () => {
      const unguarded = routes
        .filter(r => /\/(admin|moderation)\b/.test(r.routePath))
        .filter(r => !(r.id in USER_LEVEL_ROUTES_UNDER_PRIVILEGED_PATHS))
        .filter(r => r.roles.length === 0 && !hasAuthorizingGuard(r))
        .map(describeRoute);

      expect(unguarded).toEqual([]);
    });

    it('never leaves @Roles decorative', () => {
      // @Roles without RolesGuard reads exactly like a working role check and
      // enforces nothing — the decorator is inert metadata unless the guard
      // reads it. Currently zero occurrences; this keeps it that way.
      const decorative = routes
        .filter(r => r.roles.length > 0 && !r.guards.includes('RolesGuard'))
        .map(describeRoute);

      expect(decorative).toEqual([]);
    });

    it('never marks a route both @Public and @Roles', () => {
      // Contradictory: @Public short-circuits JwtAuthGuard, so req.user is
      // absent and the role check has nothing to test.
      const contradictory = routes.filter(r => r.isPublic && r.roles.length > 0).map(describeRoute);

      expect(contradictory).toEqual([]);
    });
  });

  describe('state-changing routes', () => {
    it('accepts anonymous writes only where explicitly allowed', () => {
      const anonymousWrites = routes
        .filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.httpMethod))
        .filter(r => !isAuthenticated(r))
        .filter(r => !(r.id in UNAUTHENTICATED_ROUTES))
        .map(describeRoute);

      // Stricter in spirit than the read case: an anonymous mutation is a far
      // larger commitment than an anonymous read, and deserves its own failure.
      expect(anonymousWrites).toEqual([]);
    });

    it('never exposes an anonymous DELETE', () => {
      // No reason for one to exist here. If that ever changes it should be a
      // deliberate argument, not an allowlist line added in passing.
      const anonymousDeletes = routes
        .filter(r => r.httpMethod === 'DELETE' && !isAuthenticated(r))
        .map(describeRoute);

      expect(anonymousDeletes).toEqual([]);
    });
  });

  describe('anonymous resource consumption', () => {
    it('throttles the unauthenticated auth endpoints', () => {
      // These are the credential-attack surface: login, reset, verification
      // resend. Without a limit they are free brute-force and free outbound
      // email. Excludes the stateless helpers and provider callbacks, which
      // are not credential oracles.
      const CREDENTIAL_ENDPOINTS = [
        'POST /auth/login',
        'POST /auth/register',
        'POST /auth/forgot-password',
        'POST /auth/reset-password',
        'POST /auth/resend-verification',
        'POST /auth/mfa/verify',
      ];

      const unthrottled = routes
        .filter(r => CREDENTIAL_ENDPOINTS.includes(r.id))
        .filter(r => !r.hasThrottle && !r.guards.some(g => /Throttler|RateLimit/.test(g)))
        .map(describeRoute);

      expect(unthrottled).toEqual([]);
    });
  });
});
