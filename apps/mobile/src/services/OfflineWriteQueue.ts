/**
 * OfflineWriteQueue
 *
 * Persists mutating API calls to MMKV when the device is offline and replays
 * them in FIFO order once connectivity returns.
 *
 * Adding an operation
 * -------------------
 * Add one entry to `QueueOperations` and register a handler. That map is the
 * single source of truth: `enqueue` and `registerHandler` both derive their
 * types from it, so a payload that does not match its operation is a compile
 * error rather than a runtime surprise during a flush.
 *
 * What belongs here
 * -----------------
 * Only writes that are still correct when they land minutes later. Favouriting
 * and reviewing are — nobody else's state depends on when they arrive.
 *
 * Order creation deliberately is NOT queued: bags are finite and expire the
 * same day, so replaying a stale order would sell stock that is already gone or
 * past its pickup window. Offline checkout must fail loudly at the time, not
 * succeed quietly and surprise the user later.
 *
 * Design decisions:
 *   - MMKV-backed: survives app kills (unlike an in-memory mutation pause)
 *   - Ids are stable per (type + subject) so repeated edits collapse to the
 *     latest intent rather than replaying every intermediate step
 *   - Max 100 items; oldest drop on overflow (FIFO eviction)
 *   - NetInfo listener is independent of offlineManager to avoid circular deps
 */

import { addEventListener as addNetInfoEventListener } from '@react-native-community/netinfo';

import { storage } from '@/storage/mmkv';
import { Logger } from '@/utils/logger';

import type { CreateReviewRequest } from '@foodwaste/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Every queueable operation and the payload it carries.
 *
 * One entry per operation — this is the only place that needs editing to add a
 * new one.
 */
interface QueueOperations {
  /** Add or remove a favorite. Collapses by offer: last intent wins. */
  FAVORITE_TOGGLE: {
    favoriteType: string; // FavoriteType enum value (string)
    offerId: string;
    offerName?: string;
    offerImage?: string;
  };

  /**
   * Submit an order review. Collapses by order, so re-submitting replaces the
   * earlier draft rather than posting twice.
   *
   * Carries the request DTO itself instead of re-describing its fields — the
   * shape then cannot drift from what the endpoint accepts.
   */
  REVIEW_SUBMIT: CreateReviewRequest;
}

type QueueItemType = keyof QueueOperations;

interface QueueItem<T extends QueueItemType = QueueItemType> {
  /** Stable id in the form `TYPE:subjectId`, so duplicates collapse. */
  id: string;
  type: T;
  payload: QueueOperations[T];
  enqueuedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = '@wfa:offline_write_queue';
const MAX_ITEMS = 100;

// ─── Service ──────────────────────────────────────────────────────────────────

class OfflineWriteQueue {
  private _isFlushing = false;
  private _netInfoUnsubscribe: (() => void) | null = null;

  // ── Persistence helpers ──────────────────────────────────────────────────

  private read(): QueueItem[] {
    try {
      const raw = storage.getString(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueueItem[];
    } catch {
      return [];
    }
  }

  private write(items: QueueItem[]): void {
    try {
      storage.set(QUEUE_KEY, JSON.stringify(items));
    } catch (error) {
      Logger.warn('[OfflineWriteQueue] Failed to persist queue', {}, error as Error);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Add an item to the queue.
   * If an item with the same id already exists it is **replaced** (idempotent toggle logic).
   * If the queue exceeds MAX_ITEMS, the oldest entries are evicted.
   */
  enqueue<T extends QueueItemType>(item: Omit<QueueItem<T>, 'enqueuedAt'>): void {
    const items = this.read().filter(i => i.id !== item.id); // deduplicate by id
    const newItem = { ...item, enqueuedAt: Date.now() } as QueueItem;
    const updated = [...items, newItem].slice(-MAX_ITEMS); // FIFO eviction
    this.write(updated);
    Logger.debug('[OfflineWriteQueue] Enqueued', { id: item.id, total: updated.length });
  }

  /** Remove a successfully processed item from the queue. */
  dequeue(id: string): void {
    const items = this.read().filter(i => i.id !== id);
    this.write(items);
  }

  /** Return a snapshot of the current queue (for debugging). */
  peek(): QueueItem[] {
    return this.read();
  }

  /** True if there are pending items. */
  hasPending(): boolean {
    return this.read().length > 0;
  }

  /**
   * Process all queued items in FIFO order.
   * Handlers for each operation type must be registered via `registerHandler`.
   * Items that succeed are removed; items that fail stay in the queue for the next flush.
   */
  async flush(): Promise<void> {
    if (this._isFlushing) return;

    const items = this.read();
    if (items.length === 0) return;

    this._isFlushing = true;
    Logger.info('[OfflineWriteQueue] Flushing', { count: items.length });

    for (const item of items) {
      const handler = this._handlers.get(item.type);
      if (!handler) {
        Logger.warn('[OfflineWriteQueue] No handler for type', { type: item.type });
        this.dequeue(item.id);
        continue;
      }

      try {
        await handler(item);
        this.dequeue(item.id);
        Logger.debug('[OfflineWriteQueue] Item processed', { id: item.id });
      } catch (error) {
        // Leave item in queue — will retry on next flush
        Logger.warn('[OfflineWriteQueue] Item failed, will retry', { id: item.id }, error as Error);
      }
    }

    this._isFlushing = false;
    Logger.info('[OfflineWriteQueue] Flush complete', { remaining: this.read().length });
  }

  // ── Handler registry ─────────────────────────────────────────────────────

  private readonly _handlers = new Map<QueueItemType, (item: QueueItem) => Promise<void>>();

  /**
   * Register the replay handler for one operation.
   *
   * Generic on the operation so the handler receives its own payload type —
   * a REVIEW_SUBMIT handler cannot be passed a FAVORITE_TOGGLE item.
   */
  registerHandler<T extends QueueItemType>(
    type: T,
    handler: (item: QueueItem<T>) => Promise<void>,
  ): void {
    this._handlers.set(type, handler as (item: QueueItem) => Promise<void>);
  }

  // ── NetInfo auto-flush ───────────────────────────────────────────────────

  /**
   * Start listening to NetInfo. When the device comes back online, flush the queue.
   * Call once from App.tsx (or offlineManager initialisation).
   */
  startListening(): void {
    if (this._netInfoUnsubscribe) return; // already listening

    this._netInfoUnsubscribe = addNetInfoEventListener(state => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      if (isOnline && this.hasPending()) {
        Logger.info('[OfflineWriteQueue] Online — auto-flushing queue');
        void this.flush();
      }
    });

    Logger.info('[OfflineWriteQueue] Listening for connectivity changes');
  }

  stopListening(): void {
    this._netInfoUnsubscribe?.();
    this._netInfoUnsubscribe = null;
  }
}

// Singleton — one instance for the lifetime of the app
export const offlineWriteQueue = new OfflineWriteQueue();
