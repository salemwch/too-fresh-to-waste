/**
 * Order domain constants — single source of truth for backend + mobile + web.
 */

/**
 * Grace period added to `offer.availableUntil` to compute `order.expiresAt`.
 * Mobile uses this to disable the pickup input client-side.
 */
export const ORDER_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes
