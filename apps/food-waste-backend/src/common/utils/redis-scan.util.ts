/**
 * Non-blocking Redis keyspace traversal.
 *
 * `KEYS` is O(N) over the ENTIRE keyspace and blocks the Redis event loop for
 * its full duration. Redis is single-threaded, and in this deployment one
 * instance backs four subsystems at once — the throttler store, the Bull broker,
 * the application cache and the Socket.IO pub/sub adapter. A single blocking
 * command therefore stalls rate limiting, job processing, caching and WebSocket
 * delivery simultaneously.
 *
 * `SCAN` is cursor-based: it returns a bounded slice per call and yields the
 * event loop between iterations. It is the only safe way to walk the keyspace
 * on a live system.
 *
 * Caveat that callers must understand: SCAN gives a *fuzzy* snapshot. Keys
 * present for the whole iteration are guaranteed to be returned at least once,
 * but keys may be returned more than once, and keys created or deleted mid-scan
 * may or may not appear. Never treat the result as an exact set. For counting,
 * rely on the reply from `DEL` (which reports what it actually removed) rather
 * than on the length of the scanned key list.
 */

/**
 * The slice of the node-redis client surface these helpers need.
 *
 * Declared structurally rather than importing `ReturnType<typeof createClient>`
 * so the helpers stay trivially testable with a fake, and so a node-redis major
 * bump surfaces here as one type error instead of seven.
 */
export interface ScannableRedisClient {
  scan(
    cursor: string,
    options: { MATCH: string; COUNT: number },
  ): Promise<{ cursor: string | number; keys: string[] }>;
  del(keys: string[]): Promise<number>;
}

/** Keys requested per SCAN round-trip. A hint to Redis, not a hard limit. */
export const DEFAULT_SCAN_COUNT = 100;

/**
 * Upper bound on SCAN round-trips for one traversal.
 *
 * SCAN terminates on its own when the cursor returns to '0'. This guard exists
 * for the pathological case where a resharding or a buggy proxy never returns
 * the terminal cursor — without it the loop would spin forever and pin the
 * event loop, which is the exact failure this module exists to prevent.
 * At the default COUNT that is ~1M keys before we give up and log.
 */
export const MAX_SCAN_ITERATIONS = 10_000;

/**
 * Walks every key matching `pattern`, invoking `onBatch` per slice.
 *
 * Streaming by design: the full key list is never materialised in Node's heap.
 * `KEYS session:*` against 100k sessions pulls roughly 5 MB into memory at once;
 * this keeps peak usage flat regardless of keyspace size.
 *
 * @returns the number of SCAN round-trips performed (useful for diagnostics)
 */
export async function scanBatches(
  client: ScannableRedisClient,
  pattern: string,
  // Sync or async: a collector that only pushes into an array has no reason to
  // be a promise, and `await` on a non-promise is a no-op.
  onBatch: (keys: string[]) => void | Promise<void>,
  count: number = DEFAULT_SCAN_COUNT,
): Promise<number> {
  // node-redis v4 uses string cursors; '0' signals both start and end of
  // iteration. Some versions reply with a number, hence the String() coercion.
  let cursor = '0';
  let iterations = 0;

  do {
    const reply = await client.scan(cursor, { MATCH: pattern, COUNT: count });
    cursor = String(reply.cursor);
    iterations++;

    if (reply.keys.length > 0) {
      await onBatch(reply.keys);
    }

    if (iterations >= MAX_SCAN_ITERATIONS) {
      // Bail rather than spin. The caller's work is incomplete, but an
      // incomplete cache invalidation is survivable; a pinned event loop is not.
      break;
    }
  } while (cursor !== '0');

  return iterations;
}

/**
 * Collects every key matching `pattern` into an array.
 *
 * Prefer {@link scanBatches} when the keys can be processed incrementally —
 * this variant reintroduces the memory cost of KEYS (though never its blocking
 * cost). Use it only for patterns known to match a small, bounded set.
 */
export async function scanKeys(
  client: ScannableRedisClient,
  pattern: string,
  count: number = DEFAULT_SCAN_COUNT,
): Promise<string[]> {
  const found: string[] = [];
  await scanBatches(
    client,
    pattern,
    keys => {
      found.push(...keys);
    },
    count,
  );
  // SCAN may yield the same key across iterations — de-duplicate so callers
  // never see a key twice.
  return [...new Set(found)];
}

/**
 * Deletes every key matching `pattern`, in bounded batches.
 *
 * @returns the number of keys actually removed, summed from the DEL replies.
 *   This is exact even though the scan itself may surface duplicates, because
 *   DEL only counts keys that existed at the moment it ran.
 */
export async function deleteByPattern(
  client: ScannableRedisClient,
  pattern: string,
  count: number = DEFAULT_SCAN_COUNT,
): Promise<number> {
  let deleted = 0;

  await scanBatches(
    client,
    pattern,
    async keys => {
      deleted += await client.del(keys);
    },
    count,
  );

  return deleted;
}
