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

/**
 * Default MMKV instance for app-wide storage
 * Uses default encryption and ID 'app'
 *
 * Note: v4.x uses createMMKV() instead of new MMKV()
 */
export const storage = createMMKV({
  id: 'app',
  // Optional: enable encryption for sensitive data
  // encryptionKey: 'your-encryption-key-here',
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
