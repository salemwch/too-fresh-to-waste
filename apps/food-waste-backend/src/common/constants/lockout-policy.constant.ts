/**
 * Centralized login-lockout policy.
 * Single source of truth imported by AuthSecurityService (Redis runtime checks)
 * and UsersService (MongoDB audit trail).  Change the value here and it takes
 * effect everywhere — no hunting for duplicates.
 */

/** Maximum consecutive failed logins before the account is locked. */
export const MAX_LOGIN_ATTEMPTS = 10;

/** Base lockout window in ms (5 min).  Progressive tiers multiply this value. */
export const BASE_LOCKOUT_DURATION = 5 * 60 * 1000;

/**
 * Progressive lockout duration keyed on cumulative attempt count.
 *   10–19 attempts → 5 min   (1×)
 *   20–29 attempts → 15 min  (3×)
 *   30+   attempts → 30 min  (6×)
 */
export function calculateLockoutDuration(attemptCount: number): number {
  if (attemptCount < 20) {
    return BASE_LOCKOUT_DURATION;
  }
  if (attemptCount < 30) {
    return BASE_LOCKOUT_DURATION * 3;
  }
  return BASE_LOCKOUT_DURATION * 6;
}
