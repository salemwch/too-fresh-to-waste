/**
 * Registration and verification thunks: sign-up, email verification, MFA.
 *
 * Extracted verbatim from authSlice.ts — no logic changes. The slice imports
 * these for its extraReducers; nothing here imports the slice, so there is no
 * cycle.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

import { SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { authService } from '../../services/authService';
import { assertMobileRole } from '../authState';

import type { RegisterRequest, MFAVerificationRequest } from '../../types';

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (request: RegisterRequest, { rejectWithValue }) => {
    try {
      Logger.info('Registration attempt started', { email: request.email });
      const response = await authService.register(request);
      Logger.info('Registration successful', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('Registration failed', { email: request.email }, error as Error);
      // DO NOT call ErrorHandler.handle() - it shows red box
      // Registration errors should be handled gracefully in UI with inline messages

      // Extract message from AppError or Error
      let errorMessage = 'Registration failed';
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

export const verifyEmailAsync = createAsyncThunk(
  'auth/verifyEmail',
  async (request: { email?: string; token: string }, { rejectWithValue }) => {
    try {
      Logger.info('Email verification attempt started', { email: request.email });
      const response = await authService.verifyEmail(request);

      // CRITICAL: Await token storage directly
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical: Fire-and-forget
      backgroundStorage.execute('verify-email-user-data', async () => {
        await SecureStorage.setUserData(JSON.stringify(response.user));
        const expiresAt = new Date(Date.now() + (response.tokens.expiresIn || 3600) * 1000);
        await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());
      });

      Logger.info('Email verified with auto-login', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('Email verification failed', { email: request.email }, error as Error);

      // Extract message from AppError or Error
      let errorMessage = 'Email verification failed';
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

export const verifyMFAAsync = createAsyncThunk(
  'auth/verifyMFA',
  async (request: MFAVerificationRequest, { rejectWithValue }) => {
    try {
      Logger.info('MFA verification attempt started');
      const response = await authService.verifyMFA(request);

      assertMobileRole(response.user?.role);

      // CRITICAL: Await token storage directly
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical: Fire-and-forget
      backgroundStorage.execute('mfa-user-data', async () => {
        await SecureStorage.setUserData(JSON.stringify(response.user));
        const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
        await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());
      });

      Logger.info('MFA verified', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('MFA verification failed', {}, error as Error);
      void ErrorHandler.handle(error as Error, { operation: 'verifyMFA' });

      // Extract message from AppError or Error
      let errorMessage = 'MFA verification failed';
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

