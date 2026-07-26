/**
 * Freshness tiers for TanStack Query
 *
 * `staleTime` was being set inline at ~25 call sites as raw arithmetic
 * (`1000 * 60 * 2`) with a comment restating the arithmetic. That makes the
 * *intent* invisible — nothing said why one screen picked 2 minutes and its
 * neighbour picked 5 — and it made a global retune a 25-file edit.
 *
 * These tiers name the intent instead. Pick the tier that matches how fast the
 * underlying thing actually changes, not a number that feels about right.
 *
 * Remember what staleTime does: it does NOT hide data. A stale query still
 * renders instantly from cache, then refetches in the background
 * (`refetchOnMount` is on by default). So the cost of a shorter tier is a
 * request, not a spinner. Bias short for anything a user can act on.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const Freshness = {
  /** Changes under active use — a driver's current job, a live vote count. */
  REALTIME: 10 * SECOND,

  /** Contended inventory. Someone else can take it while you look at it. */
  LIVE: 30 * SECOND,

  /** User-owned state that a background job can change: orders, points. */
  SHORT: 2 * MINUTE,

  /** Catalogue content. Merchants edit it, but not second to second. */
  STANDARD: 5 * MINUTE,

  /** Aggregates and stats. Cheap to be a little behind. */
  LONG: 15 * MINUTE,

  /** Effectively immutable for a session: geocodes, categories, config. */
  STATIC: 30 * MINUTE,
} as const;

/**
 * How long a cache restored from disk may be shown before we prefer a clean
 * fetch.
 *
 * Deliberately far below the 24h `gcTime`. gcTime governs an in-memory cache
 * belonging to a running app; this governs bytes read off disk at launch, and
 * this is a marketplace for food that expires the same day. Restoring a
 * 20-hour-old bag list would flash sold-out and expired offers at someone who
 * just opened the app — worse than a skeleton, because it looks like an answer.
 *
 * One hour keeps the win that matters (reopening the app during a session, or
 * on a bad connection, is instant) without resurrecting yesterday's inventory.
 */
export const PERSISTED_CACHE_MAX_AGE = HOUR;
