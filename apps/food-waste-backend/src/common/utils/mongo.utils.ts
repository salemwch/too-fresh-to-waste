// src/common/utils/mongo.utils.ts
import { Types } from 'mongoose';

export const toObjectId = (id?: string) => (id ? new Types.ObjectId(id) : undefined);

/**
 * True when MongoDB rejected a write because a unique index already held the
 * key (E11000).
 *
 * This is routinely a *success* signal rather than a fault. Startup code runs
 * once per PM2 cluster worker, so "create the default row if absent" executes
 * concurrently in every process; the unique index is what decides which one
 * wins, and the losers see this error. Treating it as a failure produces noisy
 * logs at best and a crash-looping boot at worst.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}
