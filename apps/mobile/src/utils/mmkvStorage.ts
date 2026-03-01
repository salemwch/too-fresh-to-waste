/**
 * MMKV Storage Adapter for Redux Persist
 *
 * MMKV is a fast, encrypted key-value store built on top of mmap.
 * 10-100x faster than AsyncStorage, synchronous API.
 *
 * Use Case: UI state cache ONLY (not authoritative for auth tokens)
 * Authoritative auth data stored in Keychain/Keystore (SecureStorage)
 *
 * Performance:
 * - AsyncStorage: ~30ms per read (async, SQLite-backed)
 * - MMKV: ~0.3ms per read (sync, mmap-backed)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from 'redux-persist';

import { Logger } from './logger';

/**
 * Storage Strategy: MMKV with AsyncStorage Fallback
 *
 * MMKV (Nitro Module) initialization can fail for several reasons:
 * - Nitro Module not initialized before Redux store
 * - Native module linking issues
 * - Android architecture mismatches
 *
 * Fallback to AsyncStorage ensures app always works, albeit slower.
 *
 * Performance Comparison:
 * - MMKV: ~0.3ms per read (synchronous, encrypted)
 * - AsyncStorage: ~30ms per read (async, SQLite-backed)
 *
 * For 99% of users MMKV will work. AsyncStorage is insurance for edge cases.
 */

// Flag to track which storage backend we're using
let usingMMKV = false;
let mmkvInstance: any = null;
let initializationAttempted = false;

/**
 * Try to initialize MMKV (only once)
 * Returns null if MMKV unavailable (Nitro Module not ready)
 *
 * ✅ V4 API: Uses createMMKV() function (not new MMKV() class)
 * @see https://github.com/mrousavy/react-native-mmkv/blob/main/docs/V4_UPGRADE_GUIDE.md
 */
function tryInitializeMMKV(): any {
  if (initializationAttempted) {
    return mmkvInstance;
  }

  initializationAttempted = true;

  try {
    // ✅ V4 API: Import createMMKV function (not MMKV class)
    const { createMMKV } = require('react-native-mmkv');

    if (createMMKV && typeof createMMKV === 'function') {
      // ✅ V4 API: Use createMMKV() function
      mmkvInstance = createMMKV({
        id: 'redux-persist-storage',
        encryptionKey: 'food-waste-app-redux-encryption-key-v1',
      });
      usingMMKV = true;
      Logger.info('[Storage] Using MMKV V4 (Nitro, fast, encrypted)');
      return mmkvInstance;
    } else {
      Logger.warn('[Storage] createMMKV not available, using AsyncStorage fallback');
      return null;
    }
  } catch (error) {
    Logger.warn(
      '[Storage] MMKV initialization failed, using AsyncStorage fallback',
      { error: (error as Error).message },
    );
    return null;
  }
}

/**
 * Get storage backend (MMKV or AsyncStorage)
 */
function getStorageBackend(): 'mmkv' | 'async' {
  const mmkv = tryInitializeMMKV();
  return mmkv !== null ? 'mmkv' : 'async';
}

// For external checks
export const isMMKVAvailable = (): boolean => {
  tryInitializeMMKV();
  return usingMMKV;
};

// Expose mmkv for backward compatibility (may be null)
export const mmkv = new Proxy({} as any, {
  get(_target, prop: string) {
    const instance = tryInitializeMMKV();
    if (instance && prop in instance) {
      const value = instance[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    }
    // Return no-op for unavailable MMKV
    return () => {
      Logger.warn('[MMKV] Attempted to use MMKV but it is not available');
    };
  },
});

/**
 * Redux Persist storage adapter
 * Wraps MMKV's synchronous API with async interface for redux-persist
 */
export const mmkvStorage: Storage = {
  setItem: async (key: string, value: string): Promise<void> => {
    const backend = getStorageBackend();

    if (backend === 'mmkv' && mmkvInstance) {
      try {
        mmkvInstance.set(key, value);
        Logger.debug('[Storage:MMKV] Set item', { key, size: value.length });
      } catch (error) {
        Logger.error('[Storage:MMKV] Failed to set item', { key }, error as Error);
        throw error;
      }
    } else {
      try {
        await AsyncStorage.setItem(key, value);
        Logger.debug('[Storage:AsyncStorage] Set item', { key, size: value.length });
      } catch (error) {
        Logger.error('[Storage:AsyncStorage] Failed to set item', { key }, error as Error);
        throw error;
      }
    }
  },

  getItem: async (key: string): Promise<string | null> => {
    const backend = getStorageBackend();

    if (backend === 'mmkv' && mmkvInstance) {
      try {
        const value = mmkvInstance.getString(key);
        Logger.debug('[Storage:MMKV] Get item', { key, found: value !== undefined });
        return value ?? null;
      } catch (error) {
        Logger.error('[Storage:MMKV] Failed to get item', { key }, error as Error);
        throw error;
      }
    } else {
      try {
        const value = await AsyncStorage.getItem(key);
        Logger.debug('[Storage:AsyncStorage] Get item', { key, found: value !== null });
        return value;
      } catch (error) {
        Logger.error('[Storage:AsyncStorage] Failed to get item', { key }, error as Error);
        throw error;
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    const backend = getStorageBackend();

    if (backend === 'mmkv' && mmkvInstance) {
      try {
        // ✅ V4 API: Use remove() (not delete() - reserved keyword in C++)
        mmkvInstance.remove(key);
        Logger.debug('[Storage:MMKV] Remove item', { key });
      } catch (error) {
        Logger.error('[Storage:MMKV] Failed to remove item', { key }, error as Error);
        throw error;
      }
    } else {
      try {
        await AsyncStorage.removeItem(key);
        Logger.debug('[Storage:AsyncStorage] Remove item', { key });
      } catch (error) {
        Logger.error('[Storage:AsyncStorage] Failed to remove item', { key }, error as Error);
        throw error;
      }
    }
  },
};

/**
 * Clear all storage data (for testing or hard reset)
 */
export const clearMMKV = async (): Promise<void> => {
  const backend = getStorageBackend();

  if (backend === 'mmkv' && mmkvInstance) {
    try {
      mmkvInstance.clearAll();
      Logger.info('[Storage:MMKV] All data cleared');
    } catch (error) {
      Logger.error('[Storage:MMKV] Failed to clear data', {}, error as Error);
    }
  } else {
    try {
      await AsyncStorage.clear();
      Logger.info('[Storage:AsyncStorage] All data cleared');
    } catch (error) {
      Logger.error('[Storage:AsyncStorage] Failed to clear data', {}, error as Error);
    }
  }
};

/**
 * Get storage size (for monitoring)
 */
export const getMMKVSize = async (): Promise<number> => {
  const backend = getStorageBackend();

  if (backend === 'mmkv' && mmkvInstance) {
    try {
      const keys = mmkvInstance.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = mmkvInstance.getString(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      Logger.error('[Storage:MMKV] Failed to get storage size', {}, error as Error);
      return 0;
    }
  } else {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      Logger.error('[Storage:AsyncStorage] Failed to get storage size', {}, error as Error);
      return 0;
    }
  }
};
