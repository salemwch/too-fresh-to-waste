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
import ReactNativeConfig from 'react-native-config';

import { Logger } from './logger';

import type { Storage } from 'redux-persist';

interface MMKVInstance {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  remove(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
}

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
let mmkvInstance: MMKVInstance | null = null;
let initializationAttempted = false;

/**
 * Try to initialize MMKV (only once)
 * Returns null if MMKV unavailable (Nitro Module not ready)
 *
 * ✅ V4 API: Uses createMMKV() function (not new MMKV() class)
 * @see https://github.com/mrousavy/react-native-mmkv/blob/main/docs/V4_UPGRADE_GUIDE.md
 */
function tryInitializeMMKV(): MMKVInstance | null {
  if (initializationAttempted) {
    return mmkvInstance;
  }

  initializationAttempted = true;

  try {
    // ✅ V4 API: Lazy require — MMKV native module must not load until Nitro is ready
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { createMMKV } = require('react-native-mmkv');

    if (typeof createMMKV === 'function') {
      // ✅ V4 API: Use createMMKV() function
      const encryptionKey = ReactNativeConfig['STORAGE_ENCRYPTION_KEY'];
      if (
        encryptionKey === undefined ||
        encryptionKey === '' ||
        encryptionKey === 'default-key' ||
        encryptionKey.startsWith('REPLACE_WITH')
      ) {
        Logger.warn(
          '[Storage] STORAGE_ENCRYPTION_KEY is missing or placeholder — MMKV will not be encrypted',
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      mmkvInstance = createMMKV({
        id: 'redux-persist-storage',
        ...(encryptionKey !== undefined &&
        encryptionKey !== '' &&
        encryptionKey !== 'default-key' &&
        !encryptionKey.startsWith('REPLACE_WITH')
          ? { encryptionKey }
          : {}),
      }) as MMKVInstance;
      usingMMKV = true;
      Logger.info('[Storage] Using MMKV V4 (Nitro, fast, encrypted)');
      return mmkvInstance;
    }
    Logger.warn('[Storage] createMMKV not available, using AsyncStorage fallback');
    return null;
  } catch (error) {
    Logger.warn('[Storage] MMKV initialization failed, using AsyncStorage fallback', {
      error: (error as Error).message,
    });
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
export const mmkv = new Proxy({} as Partial<MMKVInstance>, {
  get(_target, prop: string) {
    const instance = tryInitializeMMKV();
    if (instance !== null && prop in instance) {
      const value = (instance as unknown as Record<string, unknown>)[prop];
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(instance)
        : value;
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
