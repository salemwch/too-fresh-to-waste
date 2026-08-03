/**
 * Queue identity for durable notification delivery.
 *
 * Email (Resend) and push (FCM) are third-party HTTP calls made from inside the
 * request path. Their latency and availability therefore become ours, and a
 * failure has nowhere to go: the caller's `.catch()` logs it and the
 * notification is simply lost. There is no retry, no backoff and no record that
 * a user never heard about their order.
 *
 * In a food-waste marketplace a missed pickup notification is a wasted meal and
 * a refund, so "best effort" is not good enough. Routing through Bull gives
 * retries with exponential backoff, survival across a restart, and backpressure
 * during a burst.
 */

export const NOTIFICATION_QUEUE = 'notifications';

/** The single job name this queue handles. */
export const NOTIFICATION_JOB = 'send-notification';

/**
 * Default job options.
 *
 * `attempts: 5` with exponential backoff from 2s covers roughly 2s → 4s → 8s →
 * 16s of provider trouble, which absorbs the routine blips (a slow minute at
 * Resend, an FCM rate-limit) without a human noticing.
 *
 * `removeOnComplete` / `removeOnFail` are not optional: Bull retains finished
 * jobs in Redis indefinitely by default, and this queue carries the highest
 * volume in the system. Failures are kept far longer than successes because a
 * failed notification is evidence — it is the only place that records a user
 * who should have been told something and was not.
 */
export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
