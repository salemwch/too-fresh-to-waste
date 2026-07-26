/**
 * Replay handlers for the offline write queue.
 *
 * One module registers every operation, rather than each feature wiring itself
 * up from App.tsx. Two reasons: the registration must happen exactly once and
 * before the first flush, and having it in one place makes "what can this app do
 * offline?" answerable by reading a single file.
 *
 * Adding an operation is two edits — an entry in `QueueOperations` and a handler
 * here — and TypeScript enforces that the handler matches its payload.
 *
 * Imports are lazy on purpose: this module is pulled in during app startup, and
 * eagerly importing feature services would drag their dependency graphs into the
 * initial bundle evaluation for code that may never run.
 */

import { offlineWriteQueue } from './OfflineWriteQueue';

import { Logger } from '@/utils/logger';

let registered = false;

/**
 * Register every queue handler and start listening for connectivity.
 *
 * Idempotent — calling it twice is a no-op, so a remount cannot double-register
 * and replay each queued item more than once.
 */
export function registerOfflineHandlers(): void {
  if (registered) return;
  registered = true;

  offlineWriteQueue.registerHandler('FAVORITE_TOGGLE', async item => {
    const { favoritesService } = await import('@/features/favorites/services');
    const { favoriteType, offerId, offerName, offerImage } = item.payload;

    await favoritesService.toggleFavorite(
      favoriteType as Parameters<typeof favoritesService.toggleFavorite>[0],
      offerId,
      offerName,
      offerImage,
    );
  });

  offlineWriteQueue.registerHandler('REVIEW_SUBMIT', async item => {
    const { reviewsService } = await import('@/features/offers/services/reviewsService');
    await reviewsService.createReview(item.payload);
  });

  offlineWriteQueue.startListening();
  Logger.info('[OfflineHandlers] Registered', { operations: ['FAVORITE_TOGGLE', 'REVIEW_SUBMIT'] });
}

/** Stop the connectivity listener. Pairs with the effect that registers. */
export function stopOfflineHandlers(): void {
  offlineWriteQueue.stopListening();
}
