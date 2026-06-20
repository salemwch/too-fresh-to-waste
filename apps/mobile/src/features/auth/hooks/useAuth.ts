import { useState, useEffect, useCallback } from 'react';

import { SecureStorage } from '../../../services/SecureStorage';
import { Logger } from '../../../utils/logger';

import type { User, AuthTokens } from '../types';

const getError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined;

/**
 * Custom hook for managing authentication state.
 * Reads tokens exclusively from Keychain (SecureStorage) — never AsyncStorage.
 *
 * @returns {Object} Auth state including tokens, user, loading, and authenticated status
 *
 * @example
 * const { tokens, user, isAuthenticated, isLoading } = useAuth();
 */
export const useAuth = () => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load authentication state from Keychain + AsyncStorage (non-sensitive user data).
   * SecureStorage is the authoritative source for tokens.
   */
  const loadAuthState = useCallback(async () => {
    try {
      setIsLoading(true);

      const [{ accessToken, refreshToken }, userStr] = await Promise.all([
        SecureStorage.getTokensWithRetry(),
        SecureStorage.getUserData(),
      ]);

      if (accessToken != null && refreshToken != null) {
        setTokens({ accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer' });
      }

      if (userStr != null) {
        const parsedUser = JSON.parse(userStr) as User;
        setUser(parsedUser);
      }
    } catch (error) {
      Logger.error('[useAuth] Failed to load auth state', undefined, getError(error));
      await SecureStorage.clearAll();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save authentication state to Keychain (tokens) and AsyncStorage (user data).
   */
  const saveAuthState = useCallback(async (newTokens: AuthTokens, newUser: User) => {
    try {
      await Promise.all([
        SecureStorage.setTokens(newTokens.accessToken, newTokens.refreshToken),
        SecureStorage.setUserData(JSON.stringify(newUser)),
      ]);
      setTokens(newTokens);
      setUser(newUser);
    } catch (error) {
      Logger.error('[useAuth] Failed to save auth state', undefined, getError(error));
      throw error;
    }
  }, []);

  /**
   * Clear all authentication state from secure storage.
   */
  const clearAuthState = useCallback(async () => {
    try {
      await SecureStorage.clearAll();
      setTokens(null);
      setUser(null);
    } catch (error) {
      Logger.error('[useAuth] Failed to clear auth state', undefined, getError(error));
      throw error;
    }
  }, []);

  // Load auth state on mount
  useEffect(() => {
    void loadAuthState();
  }, [loadAuthState]);

  return {
    tokens,
    user,
    isAuthenticated: !!tokens && !!user,
    isLoading,
    saveAuthState,
    clearAuthState,
    refreshAuthState: loadAuthState,
  };
};
