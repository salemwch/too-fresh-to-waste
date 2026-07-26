/**
 * Account thunks: deletion, profile sync and profile update.
 *
 * Extracted verbatim from authSlice.ts — no logic changes. The slice imports
 * these for its extraReducers; nothing here imports the slice, so there is no
 * cycle.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

import { queryClient } from '@/lib/react-query/queryClient';
import { SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { Logger } from '@/utils/logger';

import { authService } from '../../services/authService';
import { authKeys } from '../../queryKeys';

import type { User } from '../../types';

export const deleteAccountAsync = createAsyncThunk(
  'auth/deleteAccount',
  async (_, { rejectWithValue }) => {
    // Read access token from Keychain — never from Redux state
    const accessToken = await SecureStorage.getAccessToken();

    if (accessToken == null || accessToken === '') {
      return rejectWithValue({ message: 'No access token available' });
    }

    try {
      Logger.info('[AUTH] Account deletion started');

      // Cancel all inflight requests before deletion
      const { cancelInflightRequests } = await import('@/services/requestCancellation');
      cancelInflightRequests();

      // Clear TanStack Query cache. Was a dynamic import to defer module
      // weight; now redundant, since the seed above imports queryClient
      // statically and App.tsx loads it at startup regardless.
      queryClient.clear();

      // Call backend DELETE /auth/me
      await authService.deleteAccount(accessToken);

      // Clear all local storage (same as logout)
      await SecureStorage.clearAll();

      Logger.info('[AUTH] Account deletion completed');
      return undefined;
    } catch (error) {
      Logger.error('[AUTH] Account deletion failed', {}, error as Error);

      let errorMessage = 'Failed to delete account';
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return rejectWithValue({ message: errorMessage });
    }
  },
);

export const syncCurrentUserAsync = createAsyncThunk(
  'auth/syncCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = await SecureStorage.getAccessToken();

      if (accessToken == null || accessToken === '') {
        throw new Error('No access token available');
      }

      Logger.info('[AUTH] Syncing user data from server');
      const user = await authService.getCurrentUser(accessToken);

      backgroundStorage.execute('sync-user-data', async () => {
        await SecureStorage.setUserData(JSON.stringify(user));
      });

      // Seed the React Query cache from this one fetch. useCurrentUser is gated
      // on isUserSynced, so it stays disabled until the fulfilled reducer below
      // flips it — at which point this data is already present and fresh, and no
      // second /auth/me goes out. Without the seed the two paths each fetch.
      //
      // Statically imported, unlike deleteAccountAsync's lazy one below. That
      // pattern defers module weight, but App.tsx imports QueryProvider — and so
      // queryClient — at startup regardless, so there is nothing to defer. What
      // it does cost is testability: `await import()` is not transformed under
      // this Jest config and throws inside the try, which would turn a broken
      // seed into a silent rejection and quietly restore the duplicate request.
      queryClient.setQueryData(authKeys.me(), user);

      Logger.info('[AUTH] User data synced successfully', { userId: user.userId });
      return user;
    } catch (error) {
      Logger.warn('[AUTH] User sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      let errorMessage = 'User sync failed';
      let statusCode: number | undefined;

      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
        if (typeof errObj['statusCode'] === 'number') {
          statusCode = errObj['statusCode'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      const isNetworkError =
        errorMessage === 'Network request failed' ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('econnrefused') ||
        errorMessage.toLowerCase().includes('econnaborted') ||
        (error !== null &&
          typeof error === 'object' &&
          'type' in error &&
          ((error as { type: string }).type === 'NETWORK' ||
            (error as { type: string }).type === 'SERVER_ERROR'));

      const isServerError = statusCode !== undefined && statusCode >= 500 && statusCode < 600;

      const isAuthError = statusCode === 401 || statusCode === 403;

      return rejectWithValue({
        message: errorMessage,
        isNetworkError,
        isServerError,
        isAuthError,
      });
    }
  },
);

export const updateProfileAsync = createAsyncThunk(
  'auth/updateProfile',
  async (
    updates: Partial<Omit<User, 'userId' | 'email' | 'role' | 'createdAt' | 'updatedAt'>>,
    { rejectWithValue },
  ) => {
    try {
      // Read access token from Keychain — never from Redux state
      const accessToken = await SecureStorage.getAccessToken();

      if (accessToken == null || accessToken === '') {
        throw new Error('No access token available');
      }

      Logger.info('Updating user profile', { fields: Object.keys(updates) });
      const updatedUser = await authService.updateProfile(updates, accessToken);

      // Update stored user data in Keychain
      await SecureStorage.setUserData(JSON.stringify(updatedUser));

      Logger.info('Profile updated successfully', { userId: updatedUser.userId });
      return updatedUser;
    } catch (error) {
      Logger.error('Failed to update profile', {}, error as Error);

      // Extract message from AppError or Error
      let errorMessage = 'Failed to update profile';
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return rejectWithValue({
        message: errorMessage,
      });
    }
  },
);

// Slice
