/**
 * Secure Storage Service
 * Uses react-native-keychain for encrypted token storage
 *
 * PRODUCTION: Keychain/Keystore is the AUTHORITATIVE source for tokens
 * MMKV/Redux is only a UI cache for fast rendering
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import { Logger } from '@/utils/logger';

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_DATA: 'auth_user_data',
  SESSION_EXPIRES_AT: 'auth_session_expires_at',
  LAST_LOGIN_TIME: 'auth_last_login_time',
  USE_BIOMETRIC: 'settings_use_biometric',
} as const;

/**
 * Keychain Service Names (for iOS Keychain and Android Keystore)
 */
const KEYCHAIN_SERVICE = 'com.foodwaste.app';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 100,
  MAX_DELAY_MS: 1000,
} as const;

/**
 * Delay helper for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(exponentialDelay, RETRY_CONFIG.MAX_DELAY_MS);
}

export class SecureStorage {
  /**
   * Store access token securely
   */
  static async setAccessToken(token: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(STORAGE_KEYS.ACCESS_TOKEN, token, {
        service: `${KEYCHAIN_SERVICE}.access`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      Logger.debug('[SecureStorage] Access token stored');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to store access token', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get access token with retry logic
   * PRODUCTION: Authoritative source for access tokens
   *
   * @param maxRetries - Maximum retry attempts (default 3)
   * @returns Access token or null if not found after retries
   */
  static async getAccessTokenWithRetry(
    maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: `${KEYCHAIN_SERVICE}.access`,
        });

        if (credentials && typeof credentials !== 'boolean') {
          Logger.debug('[SecureStorage] Access token retrieved', { attempt });
          return credentials.password;
        }

        Logger.debug('[SecureStorage] No access token found', { attempt });
        return null;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        Logger.warn(
          `[SecureStorage] Failed to get access token (attempt ${attempt}/${maxRetries})`,
          { error: (error as Error).message },
        );

        if (isLastAttempt) {
          Logger.error(
            '[SecureStorage] All retries exhausted for access token',
            {},
            error as Error,
          );
          return null;
        }

        // Exponential backoff
        const delayMs = getBackoffDelay(attempt);
        await delay(delayMs);
      }
    }

    return null;
  }

  /**
   * Get access token (no retry - legacy method)
   */
  static async getAccessToken(): Promise<string | null> {
    return this.getAccessTokenWithRetry(1); // Single attempt
  }

  /**
   * Store refresh token securely
   */
  static async setRefreshToken(token: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(STORAGE_KEYS.REFRESH_TOKEN, token, {
        service: `${KEYCHAIN_SERVICE}.refresh`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      Logger.debug('[SecureStorage] Refresh token stored');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to store refresh token', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get refresh token with retry logic
   * PRODUCTION: Authoritative source for refresh tokens
   *
   * @param maxRetries - Maximum retry attempts (default 3)
   * @returns Refresh token or null if not found after retries
   */
  static async getRefreshTokenWithRetry(
    maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: `${KEYCHAIN_SERVICE}.refresh`,
        });

        if (credentials && typeof credentials !== 'boolean') {
          Logger.debug('[SecureStorage] Refresh token retrieved', { attempt });
          return credentials.password;
        }

        Logger.debug('[SecureStorage] No refresh token found', { attempt });
        return null;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        Logger.warn(
          `[SecureStorage] Failed to get refresh token (attempt ${attempt}/${maxRetries})`,
          { error: (error as Error).message },
        );

        if (isLastAttempt) {
          Logger.error(
            '[SecureStorage] All retries exhausted for refresh token',
            {},
            error as Error,
          );
          return null;
        }

        // Exponential backoff
        const delayMs = getBackoffDelay(attempt);
        await delay(delayMs);
      }
    }

    return null;
  }

  /**
   * Get refresh token (no retry - legacy method)
   */
  static async getRefreshToken(): Promise<string | null> {
    return this.getRefreshTokenWithRetry(1); // Single attempt
  }

  /**
   * Store both tokens
   */
  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([this.setAccessToken(accessToken), this.setRefreshToken(refreshToken)]);
  }

  /**
   * Get both tokens with retry logic (PRODUCTION)
   * AUTHORITATIVE source for auth tokens
   *
   * @param maxRetries - Maximum retry attempts (default 3)
   * @returns Tokens or null values if not found after retries
   */
  static async getTokensWithRetry(maxRetries: number = RETRY_CONFIG.MAX_RETRIES): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    Logger.info('[SecureStorage] Getting tokens with retry', { maxRetries });

    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessTokenWithRetry(maxRetries),
      this.getRefreshTokenWithRetry(maxRetries),
    ]);

    Logger.info('[SecureStorage] Tokens retrieved', {
      hasAccessToken: !(accessToken == null),
      hasRefreshToken: !(refreshToken == null),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Get both tokens (no retry - legacy method for compatibility)
   */
  static async getTokens(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    return this.getTokensWithRetry(1); // Single attempt for backwards compatibility
  }

  /**
   * Clear all tokens
   */
  static async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        Keychain.resetGenericPassword({ service: `${KEYCHAIN_SERVICE}.access` }),
        Keychain.resetGenericPassword({ service: `${KEYCHAIN_SERVICE}.refresh` }),
      ]);
      Logger.info('[SecureStorage] Tokens cleared');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to clear tokens', {}, error as Error);
      throw error;
    }
  }

  /**
   * Store user data (non-sensitive, can use AsyncStorage)
   */
  static async setUserData(userData: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, userData);
      Logger.debug('[SecureStorage] User data stored');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to store user data', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get user data
   */
  static async getUserData(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      Logger.error('[SecureStorage] Failed to get user data', {}, error as Error);
      return null;
    }
  }

  /**
   * Store session metadata
   */
  static async setSessionMetadata(expiresAt: string, lastLoginTime: string): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.SESSION_EXPIRES_AT, expiresAt),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_LOGIN_TIME, lastLoginTime),
      ]);
      Logger.debug('[SecureStorage] Session metadata stored');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to store session metadata', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get session metadata
   */
  static async getSessionMetadata(): Promise<{
    expiresAt: string | null;
    lastLoginTime: string | null;
  }> {
    try {
      const [expiresAt, lastLoginTime] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_EXPIRES_AT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOGIN_TIME),
      ]);

      return { expiresAt, lastLoginTime };
    } catch (error) {
      Logger.error('[SecureStorage] Failed to get session metadata', {}, error as Error);
      return { expiresAt: null, lastLoginTime: null };
    }
  }

  /**
   * Clear all auth data
   */
  static async clearAll(): Promise<void> {
    try {
      await Promise.all([
        this.clearTokens(),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRES_AT),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_LOGIN_TIME),
      ]);
      Logger.info('[SecureStorage] All auth data cleared');
    } catch (error) {
      Logger.error('[SecureStorage] Failed to clear all auth data', {}, error as Error);
      throw error;
    }
  }

  /**
   * Check if biometric is enabled by user
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.USE_BIOMETRIC);
      return value === 'true';
    } catch (error) {
      Logger.error('[SecureStorage] Failed to check biometric setting', {}, error as Error);
      return false;
    }
  }

  /**
   * Enable/disable biometric authentication
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USE_BIOMETRIC, enabled.toString());
      Logger.info(`[SecureStorage] Biometric authentication ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Logger.error('[SecureStorage] Failed to set biometric setting', {}, error as Error);
      throw error;
    }
  }

  /**
   * Migrate tokens from AsyncStorage to Keychain
   * Call this on app startup after update
   */
  static async migrateFromAsyncStorage(): Promise<void> {
    try {
      // Check if migration is needed
      const oldAccessToken = await AsyncStorage.getItem('auth_tokens');
      if (oldAccessToken == null) {
        Logger.debug('[SecureStorage] No old tokens to migrate');
        return;
      }

      // Parse old tokens
      const oldData = JSON.parse(oldAccessToken);

      // Migrate to secure storage
      if (Boolean(oldData.accessToken)) {
        await this.setAccessToken(oldData.accessToken);
      }
      if (Boolean(oldData.refreshToken)) {
        await this.setRefreshToken(oldData.refreshToken);
      }

      // Remove old data
      await AsyncStorage.removeItem('auth_tokens');

      Logger.info('[SecureStorage] Successfully migrated tokens');
    } catch (error) {
      Logger.error('[SecureStorage] Token migration failed', {}, error as Error);
    }
  }
}
