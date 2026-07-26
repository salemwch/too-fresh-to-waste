/**
 * Sign-in thunks: email/password and Google OAuth.
 *
 * Extracted verbatim from authSlice.ts — no logic changes. The slice imports
 * these for its extraReducers; nothing here imports the slice, so there is no
 * cycle.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

import { SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { Logger } from '@/utils/logger';

import { authService } from '../../services/authService';
import { assertMobileRole } from '../authState';

import type { LoginRequest } from '../../types';

export const loginAsync = createAsyncThunk(
  'auth/login',
  async (request: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authService.login(request);

      assertMobileRole(response.user?.role);

      // CRITICAL: await token write before returning.
      // The session middleware starts immediately when AUTHENTICATED fires and reads
      // the refresh token from Keychain. On New Architecture (JSI/TurboModules) native
      // calls are no longer serialised through the old bridge queue, so a fire-and-forget
      // write races the middleware's read — if the read wins, validateTokenLocally sees
      // null → performLocalLogout → SESSION_EXPIRED, and the user never reaches MainStack.
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical writes: fire-and-forget is fine (user data + metadata are
      // not read by the session manager on startup).
      backgroundStorage.execute('login-persist', async () => {
        const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
        await Promise.all([
          SecureStorage.setUserData(JSON.stringify(response.user)),
          SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString()),
        ]);
      });
      return response;
    } catch (error) {
      Logger.error('Login failed', { email: request.email }, error as Error);
      // DO NOT call ErrorHandler.handle() - it shows red box
      // Login errors should be handled gracefully in UI

      // Preserve field-specific error information from backend (field, type)
      // for inline error display in the form
      let errorMessage = 'Login failed';

      // Extract message from AppError or Error
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      const errorPayload: Record<string, unknown> = {
        message: errorMessage,
      };

      // Check if error has field/errorCode/lockout/validationErrors metadata
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['field'] === 'string') {
          errorPayload['field'] = errObj['field'];
        }
        if (typeof errObj['errorCode'] === 'string') {
          errorPayload['type'] = errObj['errorCode'];
        }
        if (errObj['isAccountLocked'] === true) {
          errorPayload['isAccountLocked'] = true;
        }
        if (errObj['blockedUntil'] !== null && errObj['blockedUntil'] !== undefined) {
          errorPayload['blockedUntil'] = errObj['blockedUntil'];
        }
        // Preserve field-level validation errors (class-validator 400 responses)
        if (errObj['validationErrors'] !== null && typeof errObj['validationErrors'] === 'object') {
          errorPayload['validationErrors'] = errObj['validationErrors'];
        }
      }

      return rejectWithValue(errorPayload);
    }
  },
);

export const googleSignInAsync = createAsyncThunk(
  'auth/googleSignIn',
  async (
    { idToken, referralCode }: { idToken: string; referralCode?: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await authService.googleSignIn(idToken, referralCode);

      assertMobileRole(response.user?.role);

      // CRITICAL: await token write before returning.
      // The session middleware starts immediately when AUTHENTICATED fires and
      // reads the refresh token from Keychain. On New Architecture (JSI/TurboModules)
      // native calls are no longer serialised through the old bridge queue, so a
      // fire-and-forget write races the middleware's read — if the read wins,
      // validateTokenLocally sees null → performLocalLogout → SESSION_EXPIRED,
      // and the user never reaches MainStack.
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical writes: fire-and-forget is fine (user data + metadata are
      // not read by the session manager on startup).
      backgroundStorage.execute('google-signin-persist', async () => {
        const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
        await Promise.all([
          SecureStorage.setUserData(JSON.stringify(response.user)),
          SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString()),
        ]);
      });

      return response;
    } catch (error) {
      Logger.error('Google Sign-In failed', {}, error as Error);

      let rawMessage = '';
      let errorType = '';
      let errorCode = '';
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') rawMessage = errObj['message'];
        if (typeof errObj['type'] === 'string') errorType = errObj['type'];
        if (typeof errObj['errorCode'] === 'string') errorCode = errObj['errorCode'];
      } else if (error instanceof Error) {
        rawMessage = error.message;
      }

      const lower = rawMessage.toLowerCase();
      let errorMessage: string;

      if (
        lower.includes('suspended') ||
        lower.includes('no longer active') ||
        errorCode === 'ACCOUNT_SUSPENDED'
      ) {
        errorMessage = 'Your account has been suspended. Please contact support for assistance.';
      } else if (
        lower.includes('not currently active') ||
        lower.includes('not active') ||
        errorCode === 'ACCOUNT_INACTIVE'
      ) {
        errorMessage =
          'Your account is not currently active. Please contact support for assistance.';
      } else if (lower.includes('locked') || lower.includes('too many')) {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (lower.includes('already exists') || lower.includes('conflict')) {
        errorMessage =
          'An account with this email already exists. Try signing in with email instead.';
      } else if (
        lower.includes('network') ||
        lower.includes('timeout') ||
        errorType === 'NETWORK'
      ) {
        errorMessage = 'Unable to connect. Please check your internet and try again.';
      } else if (lower.includes('invalid') && lower.includes('token')) {
        errorMessage = 'Google sign-in could not be verified. Please try again.';
      } else if (errorType === 'SERVER_ERROR') {
        errorMessage = 'Our servers are temporarily unavailable. Please try again later.';
      } else {
        errorMessage = 'Could not sign in with Google. Please try again.';
      }

      return rejectWithValue({ message: errorMessage });
    }
  },
);

