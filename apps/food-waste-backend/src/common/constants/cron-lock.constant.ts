/**
 * Lock names and TTLs for every scheduled job.
 *
 * Centralised for two reasons:
 *
 * 1. **The name is the lock.** Two replicas only mutually exclude when they use
 *    the identical string. A typo in one file silently disables the lock for
 *    that job, and nothing fails visibly — the job just starts running twice.
 *    Constants make that impossible.
 * 2. **The TTL is a safety property**, not a tuning knob. It must exceed the
 *    job's worst-case runtime, or a second replica starts while the first is
 *    still working. Keeping them in one table makes them reviewable together.
 *
 * Naming convention: `<module>.<job>`.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/**
 * Lock TTLs.
 *
 * Chosen as a generous multiple of observed runtime, and always shorter than
 * the interval between runs where possible — a TTL longer than the schedule
 * means a crashed holder blocks the following tick too.
 */
export const CronLockTtl = {
  /** Sub-second sweeps over a small, indexed working set. */
  QUICK: 2 * MINUTE_MS,

  /** Batch updates over a full collection. */
  STANDARD: 5 * MINUTE_MS,

  /** Aggregations, analytics rollups, archival moves. */
  HEAVY: 15 * MINUTE_MS,

  /**
   * Payout batches. Deliberately the longest: the job walks merchants
   * sequentially and makes an external banking call per merchant, so its
   * runtime scales with merchant count and with a third party's latency.
   * Running this twice pays merchants twice.
   */
  PAYOUT: 30 * MINUTE_MS,
} as const;

/** Stable lock identifiers. Never change one without meaning to. */
export const CronLockName = {
  // ── Money ────────────────────────────────────────────────────────────────
  WEEKLY_PAYOUTS: 'payments.weekly-payouts',
  RETRY_FAILED_PAYOUTS: 'payments.retry-failed-payouts',
  PAYMENT_EXPIRY: 'payments.expire-stale-payments',
  PAYMENT_RECONCILIATION: 'payments.reconciliation',

  // ── Orders & offers ──────────────────────────────────────────────────────
  ORDER_EXPIRY: 'orders.expire-orders',
  OFFER_AUTO_FEATURE: 'offers.auto-feature',
  OFFER_EXPIRY: 'offers.expire-offers',

  // ── Inventory ────────────────────────────────────────────────────────────
  INVENTORY_HOURLY: 'inventory.hourly-check',
  INVENTORY_DAILY: 'inventory.daily-reconciliation',

  // ── Reviews ──────────────────────────────────────────────────────────────
  REVIEW_ANALYTICS_DAILY: 'reviews.analytics-daily',
  REVIEW_ANALYTICS_WEEKLY: 'reviews.analytics-weekly',
  REVIEW_ANALYTICS_TRENDING: 'reviews.analytics-trending',
  REVIEW_CLEANUP: 'reviews.cleanup',
  REVIEW_REMINDERS: 'reviews.reminders',

  // ── Moderation ───────────────────────────────────────────────────────────
  MODERATION_HOURLY: 'moderation.hourly',
  MODERATION_DAILY: 'moderation.daily',
  MODERATION_REPORT_CLEANUP: 'moderation.report-cleanup',

  // ── Donations ────────────────────────────────────────────────────────────
  DONATIONS_DAILY: 'donations.daily',
  DONATIONS_MONTHLY: 'donations.monthly',

  // ── Voting ───────────────────────────────────────────────────────────────
  VOTING_CYCLE_TRANSITION: 'voting.cycle-transition',
  VOTING_TALLY: 'voting.tally',
  VOTING_CLEANUP: 'voting.cleanup',

  // ── Engagement ───────────────────────────────────────────────────────────
  STREAK_ROLLOVER: 'sustainability.streak-rollover',
  GAMIFICATION_DAILY: 'loyalty.gamification-daily',

  // ── Housekeeping ─────────────────────────────────────────────────────────
  ARCHIVE_DAILY: 'archive.daily',
  AUTH_CLEANUP: 'auth.cleanup',
  TRIAL_EXPIRY: 'admin.trial-expiry',
} as const;

export type CronLockNameValue = (typeof CronLockName)[keyof typeof CronLockName];
