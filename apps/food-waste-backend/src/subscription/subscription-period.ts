/**
 * When a paid subscription ends.
 *
 * This lived inline in SubscriptionService, which meant the Konnect payment path
 * computed an expiry and the admin `markAsPaid` path did not — it set
 * `subscriptionStatus: 'paid'` and nothing else. The daily scan selects on
 * `{ subscriptionStatus: 'paid', subscriptionExpiresAt: { $lt: now } }`, and a
 * missing field never satisfies `$lt`, so those merchants were subscribed for
 * life. Both paid establishments in production were in exactly that state.
 *
 * Pure and shared so the two paths cannot drift again.
 */

export type SubscriptionCycle = 'monthly' | 'yearly';

/**
 * A month is 30 days and a year is 365, matching what the merchant is charged
 * for — `PRICES_MILLIMES` bills yearly as twelve monthly payments.
 */
export const SUBSCRIPTION_DURATION_MS: Record<SubscriptionCycle, number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

/**
 * The new expiry after paying for one `cycle`.
 *
 * Renewing early extends from the *current* expiry rather than from today, so a
 * merchant who pays a week ahead keeps that week instead of donating it. Once
 * the subscription has lapsed the clock restarts from now — otherwise a merchant
 * returning after six months would buy an already-spent period.
 *
 * `currentExpiry` is whatever is stored, which may be undefined: that is the
 * state this module exists to stop producing, and it must still be handled here
 * because the backfill migration reads documents that have it.
 */
export function nextSubscriptionExpiry(
  cycle: SubscriptionCycle,
  currentExpiry: Date | null | undefined,
  now: Date = new Date(),
): Date {
  const stillValid =
    currentExpiry instanceof Date &&
    !Number.isNaN(currentExpiry.getTime()) &&
    currentExpiry.getTime() > now.getTime();

  const base = stillValid ? (currentExpiry as Date) : now;
  return new Date(base.getTime() + SUBSCRIPTION_DURATION_MS[cycle]);
}

/**
 * Narrow an untrusted value to a cycle, defaulting to monthly.
 *
 * Monthly is the safe default: it is the shorter grant, so a bad value cannot
 * silently hand out a free year. Callers that must not guess should validate
 * before reaching here — this is the last line, not the first.
 */
export function toSubscriptionCycle(value: unknown): SubscriptionCycle {
  return value === 'yearly' ? 'yearly' : 'monthly';
}
