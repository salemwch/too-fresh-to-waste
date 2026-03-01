/**
 * OfflineWriteQueue
 *
 * Persists mutating API calls to MMKV when the device is offline.
 * Items are replayed in FIFO order as soon as connectivity is restored.
 *
 * Supported operations (MVP):
 *   FAVORITE_TOGGLE — add / remove a favorite offer
 *
 * Design decisions:
 *   - MMKV-backed: survives app kills (unlike in-memory TanStack Query pause)
 *   - Each item is idempotent by (type + offerId), so duplicate toggles collapse
 *     to the latest intent rather than executing twice
 *   - Max 100 items; oldest drop on overflow (FIFO eviction)
 *   - NetInfo listener is independent of offlineManager to avoid circular deps
 */

import NetInfo from '@react-native-community/netinfo';

import { storage } from '@/storage/mmkv';
import { Logger } from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueItemType = 'FAVORITE_TOGGLE';

export interface FavoriteTogglePayload {
  favoriteType: string; // FavoriteType enum value (string)
  offerId: string;
  offerName?: string;
  offerImage?: string;
}

export interface QueueItem {
  /** Stable id = type + ":" + offerId so duplicates collapse */
  id: string;
  type: QueueItemType;
  payload: FavoriteTogglePayload;
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
  enqueue(item: Omit<QueueItem, 'enqueuedAt'>): void {
    const items = this.read().filter(i => i.id !== item.id); // deduplicate by id
    const newItem: QueueItem = { ...item, enqueuedAt: Date.now() };
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

  registerHandler(type: QueueItemType, handler: (item: QueueItem) => Promise<void>): void {
    this._handlers.set(type, handler);
  }

  // ── NetInfo auto-flush ───────────────────────────────────────────────────

  /**
   * Start listening to NetInfo. When the device comes back online, flush the queue.
   * Call once from App.tsx (or offlineManager initialisation).
   */
  startListening(): void {
    if (this._netInfoUnsubscribe) return; // already listening

    this._netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
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
