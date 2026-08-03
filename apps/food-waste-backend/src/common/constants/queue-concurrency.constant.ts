/**
 * How many jobs each Bull queue may process at once, per process.
 *
 * ## Why this file exists
 *
 * `@Process()` with no options runs **one job at a time**. Every processor in
 * this codebase was written that way, so the entire system delivered
 * notifications strictly serially: one FCM round-trip after another, roughly
 * three to six per second on a good day. Average volume fitted inside that, but
 * bursts did not — a broadcast, a merchant with many followers, or a retry
 * storm after an FCM blip would back the queue up, and "your order is ready"
 * queued behind it. That is a wasted meal, which is the one outcome this
 * product exists to prevent.
 *
 * ## How the numbers were chosen
 *
 * These jobs are almost all **I/O-bound**: an HTTP call to Resend, FCM or a
 * payment provider, plus a Mongo write. While one awaits, the event loop is
 * free, so concurrency here buys throughput at almost no CPU cost. The ceiling
 * is not the loop — it is the downstream: provider rate limits and the Mongo
 * connection pool.
 *
 * So the rule applied below is:
 *
 * - **I/O-bound, provider-rate-limited** → tens. Bounded well under the
 *   provider's published limit, and well under `MONGO_MAX_POOL_SIZE` so queue
 *   work can never starve HTTP handlers of connections.
 * - **CPU- or aggregation-heavy** → low single digits. Concurrency does not
 *   help work that occupies the event loop; it only lengthens the tail for
 *   everything sharing that loop.
 * - **Ordering- or money-sensitive** → low, and only where jobs for the *same*
 *   entity cannot interleave destructively.
 *
 * Every value is env-overridable so a queue can be throttled in production
 * without a deploy.
 *
 * ## The constraint nobody notices until it bites
 *
 * Total concurrent DB work is `sum(concurrency) × processes`. Keep that sum
 * comfortably below `MONGO_MAX_POOL_SIZE`, or queue jobs exhaust the pool and
 * HTTP requests start timing out in `waitQueueTimeoutMS` — presenting as a
 * mysterious API outage whose real cause is a queue burst. The defaults below
 * sum to 48, against a default pool of 100.
 */

/** Reads a positive integer override, falling back to the reviewed default. */
function concurrencyFromEnv(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  // A zero or negative value would silently stop the queue entirely, which is
  // indistinguishable from a hung worker. Refuse it and keep the default.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const QueueConcurrency = {
  /**
   * Highest-volume queue in the system, and the most latency-sensitive: order
   * status pushes ride it. Pure I/O — FCM/Resend call plus one Mongo write.
   *
   * FCM's per-project send quota is far above this; the practical bound is the
   * Mongo pool, not the provider.
   */
  NOTIFICATIONS: concurrencyFromEnv('QUEUE_CONCURRENCY_NOTIFICATIONS', 20),

  /**
   * Pickup reminders — a scheduled fan-out that lands in bursts on the hour.
   * Same shape as notifications; sized lower only because it is never in the
   * interactive path, so it should yield to the queue that is.
   */
  PICKUP_REMINDERS: concurrencyFromEnv('QUEUE_CONCURRENCY_PICKUP_REMINDERS', 10),

  /**
   * Third-party moderation API per review. I/O-bound and independent per job.
   */
  REVIEW_MODERATION: concurrencyFromEnv('QUEUE_CONCURRENCY_REVIEW_MODERATION', 10),

  /**
   * Per-review processing: sentiment/derived fields plus writes. Mixed CPU and
   * I/O, so mid-range rather than tens.
   */
  REVIEW_PROCESSING: concurrencyFromEnv('QUEUE_CONCURRENCY_REVIEW_PROCESSING', 5),

  /**
   * Search index maintenance. Independent per document and safe to parallelise;
   * `rebuild-index` is the heavy outlier but runs rarely.
   */
  SEARCH_INDEXING: concurrencyFromEnv('QUEUE_CONCURRENCY_SEARCH_INDEXING', 5),

  /**
   * Post-donation bookkeeping. Money-adjacent, so kept modest: enough to clear
   * a burst, low enough that a bug cannot stampede the ledger.
   */
  DONATIONS: concurrencyFromEnv('QUEUE_CONCURRENCY_DONATIONS', 5),

  /**
   * Stale-delivery auto-unassign. Jobs are keyed per order and never touch the
   * same order twice concurrently, so parallelism is safe. Kept small because
   * the queue is normally near-empty — it only fills when drivers go quiet.
   */
  DELIVERY_TIMEOUTS: concurrencyFromEnv('QUEUE_CONCURRENCY_DELIVERY_TIMEOUTS', 5),

  /**
   * Establishment/industry analytics rollups: multi-stage aggregations that
   * hold the event loop while assembling results.
   *
   * Deliberately near-serial. Raising this does not make aggregations finish
   * sooner — MongoDB is doing that work — but it does multiply the number of
   * large result sets being hydrated in this process at once, which is how a
   * worker hits `max_memory_restart` and drops every in-flight job with it.
   */
  REVIEW_ANALYTICS: concurrencyFromEnv('QUEUE_CONCURRENCY_REVIEW_ANALYTICS', 2),
} as const;
