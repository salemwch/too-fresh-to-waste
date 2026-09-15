/**
 * Canonical default token lifetimes.
 *
 * Single source of truth, imported by both the place that ENFORCES these
 * values (`env.validation.ts`, as its Joi defaults) and the place that
 * REPORTS them (`CookieSecurityUtil.getSecurityConfig`).
 *
 * That split is the reason this module exists. The diagnostics used to carry
 * its own copy of the numbers and reported `refreshToken: '365 days'` long
 * after the real default moved to 30 days — the very change made because a
 * 365-day refresh token is a year-long account-takeover window on a bearer
 * credential. A security-reporting surface asserting a lifetime the system
 * does not use is worse than reporting nothing, because it is trusted.
 *
 * Deliberately free of any Joi import so the cookie utility does not drag the
 * validation schema into its module graph.
 */

/** Access token lifetime. Short by design; refresh handles longevity. */
export const JWT_EXPIRES_IN_DEFAULT = '15m';

/** Standard refresh lifetime. Matches the cookie maxAge in auth.controller.ts. */
export const JWT_REFRESH_EXPIRES_IN_DEFAULT = '30d';

/** "Remember me" refresh lifetime. Longer by design - the user opted in. */
export const JWT_REFRESH_REMEMBER_ME_EXPIRES_IN_DEFAULT = '365d';
