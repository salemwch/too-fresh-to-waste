/**
 * Single source of truth for the MMKV encryption key.
 *
 * Two MMKV stores exist in this app — `app` (i18n preference, offline write
 * queue) and `redux-persist-storage` (persisted Redux slices). They are kept as
 * separate store IDs on purpose: they have different lifetimes and are cleared
 * independently, and merging their IDs would orphan every existing user's data
 * on upgrade. What they must NOT have is separate opinions about encryption,
 * which is exactly what happened — `redux-persist-storage` was encrypted while
 * `app` shipped with `encryptionKey` commented out, leaving the offline write
 * queue (queued order payloads) as plaintext at rest.
 *
 * Both now resolve the key through this module.
 *
 * Fail CLOSED in production: a missing or placeholder build secret must not
 * silently downgrade users to plaintext. Dev builds warn and continue so a
 * fresh clone still runs.
 */

import ReactNativeConfig from 'react-native-config';

import { Logger } from '@/utils/logger';

const PLACEHOLDER_PREFIX = 'REPLACE_WITH';
const PLACEHOLDER_VALUES = new Set(['', 'default-key']);

let cachedKey: string | undefined;
let resolved = false;

/**
 * Returns the configured encryption key, or `undefined` when running a dev
 * build without one. Throws in release builds rather than returning undefined,
 * so no caller can accidentally create an unencrypted store in production.
 */
export function resolveEncryptionKey(): string | undefined {
  if (resolved) return cachedKey;
  resolved = true;

  const key = ReactNativeConfig['STORAGE_ENCRYPTION_KEY'];
  const isValid =
    key !== undefined && !PLACEHOLDER_VALUES.has(key) && !key.startsWith(PLACEHOLDER_PREFIX);

  if (!isValid) {
    if (!__DEV__) {
      throw new Error(
        '[Storage] STORAGE_ENCRYPTION_KEY is missing or a placeholder — refusing to start with unencrypted storage.',
      );
    }
    Logger.warn(
      '[Storage] STORAGE_ENCRYPTION_KEY missing or placeholder — storage is UNENCRYPTED (dev builds only)',
    );
    cachedKey = undefined;
    return undefined;
  }

  cachedKey = key;
  return key;
}

/**
 * Spread into a `createMMKV()` config. Yields `{ encryptionKey }` when a key is
 * available and `{}` in a keyless dev build — `exactOptionalPropertyTypes`
 * forbids passing `encryptionKey: undefined` explicitly.
 */
export function encryptionOption(): { encryptionKey?: string } {
  const key = resolveEncryptionKey();
  return key !== undefined ? { encryptionKey: key } : {};
}
