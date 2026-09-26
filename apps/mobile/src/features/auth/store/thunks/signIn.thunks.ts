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

      // A connectivity failure carries no backend message worth showing - the
      // server never answered. Swap in an i18n key so the screen renders
      // translated advice instead of "Request timed out". Everything else keeps
      // the backend's own wording, which is already user-facing and specific
      // ("Invalid email or password", "Please verify your email first").
      if (error !== null && error !== undefined && typeof error === 'object') {
        const netCode = (error as Record<string, unknown>)['errorCode'];
        if (netCode === 'TIMEOUT') {
          errorPayload['message'] = 'auth.errorServerSlow';
        } else if (netCode === 'OFFLINE') {
          errorPayload['message'] = 'auth.errorNoConnection';
        }
      }

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

/**
 * Backend code -> i18n key for a failed Google sign-in. Checked before the
 * text matches below, which only an older backend still needs: the message is
 * translated now, so "locked" / "too many" never matched in fr or ar and a
 * lockout read as a generic failure.
 */
const GOOGLE_SIGN_IN_ERROR_KEYS: Readonly<Record<string, string>> = {
  ACCOUNT_SUSPENDED: 'auth.errorAccountSuspended',
  ACCOUNT_INACTIVE: 'auth.errorAccountInactive',
  ACCOUNT_LOCKED: 'auth.errorTooManyAttempts',
  LOGIN_TEMPORARILY_BLOCKED: 'auth.errorTooManyAttempts',
  TOO_MANY_REQUESTS: 'auth.errorTooManyAttempts',
  GOOGLE_TOKEN_INVALID: 'auth.errorGoogleTokenInvalid',
  TIMEOUT: 'auth.errorServerSlow',
  OFFLINE: 'auth.errorNoConnection',
};

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

      // Resolves to an i18n key, not a sentence. These strings used to be
      // hardcoded English, so fr and ar users were shown English on every
      // failed sign-in. The screen runs it through `resolveAuthError`, which
      // translates a key and passes any non-key string through unchanged.
      let messageKey: string;
      const byCode = errorCode !== '' ? GOOGLE_SIGN_IN_ERROR_KEYS[errorCode] : undefined;

      if (byCode !== undefined) {
        messageKey = byCode;
      } else if (
        lower.includes('suspended') ||
        lower.includes('no longer active') ||
        errorCode === 'ACCOUNT_SUSPENDED'
      ) {
        messageKey = 'auth.errorAccountSuspended';
      } else if (
        lower.includes('not currently active') ||
        lower.includes('not active') ||
        errorCode === 'ACCOUNT_INACTIVE'
      ) {
        messageKey = 'auth.errorAccountInactive';
      } else if (lower.includes('locked') || lower.includes('too many')) {
        messageKey = 'auth.errorTooManyAttempts';
      } else if (lower.includes('already exists') || lower.includes('conflict')) {
        messageKey = 'auth.errorEmailAlreadyExists';
      } else if (errorCode === 'TIMEOUT') {
        // Checked before the generic NETWORK case below, which would otherwise
        // absorb it: a timeout means the server answered too slowly, not that
        // the phone is offline, and the two need different advice.
        messageKey = 'auth.errorServerSlow';
      } else if (
        errorCode === 'OFFLINE' ||
        errorType === 'NETWORK' ||
        lower.includes('network') ||
        lower.includes('timeout')
      ) {
        messageKey = 'auth.errorNoConnection';
      } else if (lower.includes('invalid') && lower.includes('token')) {
        messageKey = 'auth.errorGoogleTokenInvalid';
      } else if (errorType === 'SERVER_ERROR') {
        messageKey = 'auth.errorServerUnavailable';
      } else if (errorCode !== '' && rawMessage !== '') {
        // A backend code with no key of its own (GOOGLE_EMAIL_UNVERIFIED, ...):
        // its message is already in the app's language and says what to do.
        messageKey = rawMessage;
      } else {
        messageKey = 'auth.googleSignInFailed';
      }

      return rejectWithValue({ message: messageKey });
    }
  },
);
