/**
 * MMKV Storage Singleton
 * Fast, synchronous key-value storage for React Native
 *
 * MMKV is 30x faster than AsyncStorage and provides synchronous reads.
 * Used for device-level preferences that must be read instantly on app start
 * (e.g., onboarding flags, theme preferences, language settings).
 *
 * @see https://github.com/mrousavy/react-native-mmkv
 */

import { createMMKV } from 'react-native-mmkv';

import { encryptionOption } from './encryptionKey';

/**
 * The app's MMKV stores are split by LIFETIME, and by nothing else.
 *
 * A separate MMKV instance is only worth having when some data has different
 * clear semantics, encryption, or durability from the rest — otherwise it is
 * just two places to forget to configure. (This codebase learned that: `app`
 * and `redux-persist-storage` were split by accident rather than design, which
 * is how `app` spent so long with its encryptionKey commented out while the
 * other store was encrypted.)
 *
 *   app     — DURABLE. Data representing user intent that must survive logout,
 *             cache clears and low-storage handlers: the offline write queue
 *             (orders the user actually placed) and device preferences.
 *             Losing anything here loses something the user did.
 *
 *   cache   — DISPOSABLE. The TanStack Query cache. Safe to drop at any moment;
 *             worst case is one network round-trip. Kept apart so it CAN be
 *             dropped — a "clear cache" action or a storage-pressure handler
 *             must be able to reclaim this space without touching queued orders.
 *
 *   redux-persist-storage — Redux slices, owned by redux-persist and purged on
 *             its own schedule. See utils/mmkvStorage.ts. Kept on its own id
 *             because merging it would orphan existing users' persisted state.
 *
 * All three encrypt through the same gate in ./encryptionKey.
 */
export const storage = createMMKV({
  id: 'app',
  ...encryptionOption(),
});

/**
 * Disposable cache store. See the note above — do not put anything here that
 * the user would miss if it vanished.
 */
export const cacheStorage = createMMKV({
  id: 'cache',
  ...encryptionOption(),
});

/**
 * Type-safe storage wrapper with utility methods
 */
export const mmkvStorage = {
  /**
   * Get string value
   */
  getString(key: string): string | undefined {
    return storage.getString(key);
  },

  /**
   * Set string value
   */
  setString(key: string, value: string): void {
    storage.set(key, value);
  },

  /**
   * Get boolean value
   */
  getBoolean(key: string): boolean | undefined {
    return storage.getBoolean(key);
  },

  /**
   * Set boolean value
   */
  setBoolean(key: string, value: boolean): void {
    storage.set(key, value);
  },

  /**
   * Get number value
   */
  getNumber(key: string): number | undefined {
    return storage.getNumber(key);
  },

  /**
   * Set number value
   */
  setNumber(key: string, value: number): void {
    storage.set(key, value);
  },

  /**
   * Delete a key
   */
  remove(key: string): void {
    storage.remove(key);
  },

  /**
   * Check if key exists
   */
  contains(key: string): boolean {
    return storage.contains(key);
  },

  /**
   * Get all keys
   */
  getAllKeys(): string[] {
    return storage.getAllKeys();
  },

  /**
   * Clear all data (use with caution!)
   */
  clearAll(): void {
    storage.clearAll();
  },
} as const;
