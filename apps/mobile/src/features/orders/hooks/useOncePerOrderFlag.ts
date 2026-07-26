/**
 * A "has this happened for this order yet?" flag, persisted across sessions.
 *
 * Two of these existed inline in OrderDetailsScreen — one for "review prompt
 * shown", one for "impact moment shown" — as the same read-JSON-array,
 * check-membership, append-and-write logic against different keys. Both must
 * survive a remount (React Navigation keeps screens mounted, and the user can
 * leave and come back), which is why it is MMKV rather than state.
 *
 * The stored list is capped. Left unbounded it grows by one id per order
 * forever and is JSON.parsed in full on every mount of the screen — a cost that
 * only ever increases. Trimming the oldest means a very old order could prompt
 * again; at the cap below that is thousands of orders ago, which is a better
 * trade than an ever-growing parse.
 */

import { useCallback, useState } from 'react';

import { mmkv } from '@/utils/mmkvStorage';

/**
 * Ids retained per key. Generous enough that re-prompting is unreachable in
 * practice, small enough that the parse stays trivial.
 */
const MAX_REMEMBERED_ORDERS = 500;

function readIds(storageKey: string): string[] {
  try {
    const stored = mmkv.getString?.(storageKey);
    if (stored == null || stored === '') return [];

    const parsed: unknown = JSON.parse(stored);
    // Corrupt or hand-edited storage must not throw on every render.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @returns `[hasHappened, markAsHappened]`
 */
export function useOncePerOrderFlag(storageKey: string, orderId: string): [boolean, () => void] {
  // Lazy initialiser: reads storage once on mount, not on every render.
  const [hasHappened, setHasHappened] = useState(() => readIds(storageKey).includes(orderId));

  const markAsHappened = useCallback(() => {
    try {
      const ids = readIds(storageKey);
      if (!ids.includes(orderId)) {
        const next = [...ids, orderId].slice(-MAX_REMEMBERED_ORDERS);
        mmkv.set?.(storageKey, JSON.stringify(next));
      }
    } catch {
      // A storage failure must not block the UI — the flag still flips for this
      // session, it just will not survive a restart.
    }
    setHasHappened(true);
  }, [storageKey, orderId]);

  return [hasHappened, markAsHappened];
}
