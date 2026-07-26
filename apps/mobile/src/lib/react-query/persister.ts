/**
 * Query cache persistence
 *
 * The client is configured with `gcTime: 24h`, but that was fiction: the cache
 * lived only in memory, so every cold start threw it away and the app had to
 * complete a network round-trip before it could render anything. On a slow or
 * absent connection that means an empty Home screen for a user who has perfectly
 * good data from a minute ago.
 *
 * Backing the cache with MMKV makes the 24h gcTime mean what it says.
 *
 * WHAT IS DELIBERATELY NOT PERSISTED
 * ----------------------------------
 * Writing the cache to disk turns every cached response into data at rest, so
 * the allowlist below is a security boundary, not a performance tweak. Only
 * queries that are safe to survive a restart are dehydrated:
 *
 *   - public catalogue data (offers, establishments, search, categories)
 *   - the favourite id list (ids only, no offer content — see below)
 *
 * Everything else is dropped, including anything keyed under auth, profile,
 * orders, payment, notifications or loyalty. Those are either sensitive at rest
 * or must be re-fetched to be correct — a persisted order status could show a
 * stale "awaiting payment" for a paid order.
 *
 * Auth tokens are never in the query cache at all (Keychain only, per
 * .claude/rules/security.md); the allowlist is defence in depth.
 */

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { cacheStorage } from '@/storage/mmkv';
import { Logger } from '@/utils/logger';

import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

const CACHE_KEY = 'TFTW_QUERY_CACHE';

/**
 * Bump when the shape of any persisted query changes. A mismatch discards the
 * whole cache instead of rehydrating data the current code cannot read.
 */
export const PERSIST_BUSTER = 'v1';

/** Max age of a restored cache. Older than this and we start clean. */
export { PERSISTED_CACHE_MAX_AGE as PERSIST_MAX_AGE } from './freshness';

/**
 * Query-key prefixes that may be written to disk. Matched against the FIRST
 * element of the query key, so `['offers', 'nearby', …]` is covered by 'offers'.
 */
const PERSISTABLE_KEY_PREFIXES: ReadonlySet<string> = new Set([
  'offers',
  'establishments',
  'search',
  'categories',
  // Favourites must survive a cold start: an offline toggle patches this cache
  // and enqueues the write, and the heart has to stay filled until the queue
  // drains. This is the durability redux-persist used to provide.
  'favorites',
]);

/**
 * Decides whether a single query is written to disk.
 *
 * Errors are never persisted — restoring a failed query would show the user a
 * stale error for something that may work fine now.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;

  const [root] = query.queryKey;
  return typeof root === 'string' && PERSISTABLE_KEY_PREFIXES.has(root);
}

/**
 * MMKV-backed persister.
 *
 * MMKV is synchronous and mmap-backed (~0.3ms/read), so the whole restore
 * happens well inside a frame — no need for the async persister and no startup
 * jank. The store is encrypted via the shared gate in storage/encryptionKey.
 */
export const queryPersister: Persister = createSyncStoragePersister({
  key: CACHE_KEY,
  // The DISPOSABLE store, deliberately not the durable `app` one: this cache
  // must be safe to drop wholesale, and the offline write queue (real orders
  // the user placed) lives in `app` where a cache clear cannot reach it.
  storage: {
    getItem: (key: string): string | null => cacheStorage.getString(key) ?? null,
    setItem: (key: string, value: string): void => cacheStorage.set(key, value),
    removeItem: (key: string): void => {
      cacheStorage.remove(key);
    },
  },
  // A corrupt or oversized entry must never wedge startup: log and move on with
  // an empty cache rather than throwing inside the provider.
  serialize: (client: PersistedClient): string => {
    try {
      return JSON.stringify(client);
    } catch (error) {
      Logger.warn('[QueryPersist] Failed to serialize cache — skipping persist', {
        error: (error as Error).message,
      });
      return '';
    }
  },
  deserialize: (cached: string): PersistedClient => JSON.parse(cached) as PersistedClient,
});
