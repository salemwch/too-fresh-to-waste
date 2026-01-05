import { useState, useEffect, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { User, AuthTokens } from '../types';

/**
 * Custom hook for managing authentication state
 * Loads tokens and user data from AsyncStorage and provides auth state
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
   * Load authentication state from AsyncStorage
   * Retrieves both auth tokens and user data in parallel
   */
  const loadAuthState = useCallback(async () => {
    try {
      setIsLoading(true);

      const [tokensStr, userStr] = await Promise.all([
        AsyncStorage.getItem('auth_tokens'),
        AsyncStorage.getItem('auth_user'),
      ]);

      if (tokensStr) {
        const parsedTokens = JSON.parse(tokensStr) as AuthTokens;
        setTokens(parsedTokens);
      }

      if (userStr) {
        const parsedUser = JSON.parse(userStr) as User;
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('[useAuth] Failed to load auth state:', error);
      // Clear potentially corrupted data
      await AsyncStorage.multiRemove(['auth_tokens', 'auth_user']);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save authentication state to AsyncStorage
   * Persists both tokens and user data
   */
  const saveAuthState = useCallback(async (newTokens: AuthTokens, newUser: User) => {
    try {
      await AsyncStorage.multiSet([
        ['auth_tokens', JSON.stringify(newTokens)],
        ['auth_user', JSON.stringify(newUser)],
      ]);
      setTokens(newTokens);
      setUser(newUser);
    } catch (error) {
      console.error('[useAuth] Failed to save auth state:', error);
      throw error;
    }
  }, []);

  /**
   * Clear authentication state from AsyncStorage
   * Removes both tokens and user data
   */
  const clearAuthState = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(['auth_tokens', 'auth_user']);
      setTokens(null);
      setUser(null);
    } catch (error) {
      console.error('[useAuth] Failed to clear auth state:', error);
      throw error;
    }
  }, []);

  // Load auth state on mount
  useEffect(() => {
    loadAuthState();
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

/**
 * Get access token directly from AsyncStorage
 * Useful for one-off operations without hook
 *
 * @returns {Promise<string | null>} The access token or null
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const tokensStr = await AsyncStorage.getItem('auth_tokens');
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr) as AuthTokens;
      return tokens.accessToken;
    }
    return null;
  } catch (error) {
    console.error('[getAccessToken] Failed to get access token:', error);
    return null;
  }
};

/**
 * Get refresh token directly from AsyncStorage
 * Useful for token refresh operations
 *
 * @returns {Promise<string | null>} The refresh token or null
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const tokensStr = await AsyncStorage.getItem('auth_tokens');
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr) as AuthTokens;
      return tokens.refreshToken;
    }
    return null;
  } catch (error) {
    console.error('[getRefreshToken] Failed to get refresh token:', error);
    return null;
  }
};
