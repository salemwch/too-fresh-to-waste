/**
 * Secure Storage Service
 * Uses react-native-keychain for encrypted token storage
 * More secure than AsyncStorage or MMKV for sensitive data
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
      Logger.debug('Access token stored securely');
    } catch (error) {
      Logger.error('Failed to store access token', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get access token
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${KEYCHAIN_SERVICE}.access`,
      });

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password;
      }
      return null;
    } catch (error) {
      Logger.error('Failed to get access token', {}, error as Error);
      return null;
    }
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
      Logger.debug('Refresh token stored securely');
    } catch (error) {
      Logger.error('Failed to store refresh token', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get refresh token
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${KEYCHAIN_SERVICE}.refresh`,
      });

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password;
      }
      return null;
    } catch (error) {
      Logger.error('Failed to get refresh token', {}, error as Error);
      return null;
    }
  }

  /**
   * Store both tokens
   */
  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([this.setAccessToken(accessToken), this.setRefreshToken(refreshToken)]);
  }

  /**
   * Get both tokens
   */
  static async getTokens(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);

    return { accessToken, refreshToken };
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
      Logger.info('Tokens cleared from secure storage');
    } catch (error) {
      Logger.error('Failed to clear tokens', {}, error as Error);
      throw error;
    }
  }

  /**
   * Store user data (non-sensitive, can use AsyncStorage)
   */
  static async setUserData(userData: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, userData);
      Logger.debug('User data stored');
    } catch (error) {
      Logger.error('Failed to store user data', {}, error as Error);
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
      Logger.error('Failed to get user data', {}, error as Error);
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
      Logger.debug('Session metadata stored');
    } catch (error) {
      Logger.error('Failed to store session metadata', {}, error as Error);
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
      Logger.error('Failed to get session metadata', {}, error as Error);
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
      Logger.info('All auth data cleared');
    } catch (error) {
      Logger.error('Failed to clear all auth data', {}, error as Error);
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
      Logger.error('Failed to check biometric setting', {}, error as Error);
      return false;
    }
  }

  /**
   * Enable/disable biometric authentication
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USE_BIOMETRIC, enabled.toString());
      Logger.info(`Biometric authentication ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Logger.error('Failed to set biometric setting', {}, error as Error);
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
      if (!oldAccessToken) {
        Logger.debug('No old tokens to migrate');
        return;
      }

      // Parse old tokens
      const oldData = JSON.parse(oldAccessToken);

      // Migrate to secure storage
      if (oldData.accessToken) {
        await this.setAccessToken(oldData.accessToken);
      }
      if (oldData.refreshToken) {
        await this.setRefreshToken(oldData.refreshToken);
      }

      // Remove old data
      await AsyncStorage.removeItem('auth_tokens');

      Logger.info('Successfully migrated tokens to secure storage');
    } catch (error) {
      Logger.error('Token migration failed', {}, error as Error);
    }
  }
}
