import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';

import { SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { authService } from '../services/authService';
import { AuthFlowState } from '../types';

import type {
  AuthState,
  User,
  LoginRequest,
  RegisterRequest,
  MFAVerificationRequest,
} from '../types';
import type { RootState } from '@/store';

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: undefined,
  lastLoginTime: null,
  sessionExpiresAt: null,
  flowState: AuthFlowState.INITIALIZING,
  pendingVerificationEmail: undefined,
  pendingVerificationPhone: undefined,
  mfaToken: undefined,
  passwordResetToken: undefined,
  // Offline mode
  isOffline: false,
  offlineMessage: undefined,
  retryAfterMs: undefined,
  offlineSince: undefined,
  // Post-resume token-recovery gate (see authSessionMiddleware)
  isRecoveringSession: false,
  // Cold-start user sync (fresh data from /auth/me)
  isUserSynced: false,
};

// ✅ PROMISE-BASED LOCK: Prevent concurrent logout calls
// Using Promise instead of boolean flag for true concurrency control
let logoutLock: Promise<void> | null = null;

// Async thunks
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (request: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authService.login(request);

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
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          rawMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        rawMessage = error.message;
      }

      let errorMessage = 'Could not sign in with Google. Please try again.';
      const lower = rawMessage.toLowerCase();
      if (lower.includes('invalid') && lower.includes('token')) {
        errorMessage = 'Google sign-in failed. Please try again or use email instead.';
      } else if (lower.includes('network') || lower.includes('timeout')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      return rejectWithValue({ message: errorMessage });
    }
  },
);

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

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      // Read refresh token from Keychain — never from Redux state
      const refreshToken = await SecureStorage.getRefreshToken();

      if (refreshToken == null || refreshToken === '') {
        throw new Error('No refresh token available');
      }

      Logger.debug('Token refresh attempt started');
      const response = await authService.refreshToken({ refreshToken });

      // ✅ CRITICAL FIX: Token persistence MUST be awaited, NOT fire-and-forget!
      //
      // WHY THIS MATTERS:
      // Backend uses TOKEN ROTATION - when refresh succeeds:
      // 1. Old token is IMMEDIATELY REVOKED (cannot be used again!)
      // 2. New token is issued
      //
      // If we fire-and-forget the storage and the app crashes/closes before
      // persistence completes, we lose the new tokens and the old ones are
      // already revoked → user gets logged out on next app launch.
      //
      // ATOMIC: Await token storage - if this fails, the refresh should fail
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical metadata can be fire-and-forget
      backgroundStorage.execute('refresh-metadata', async () => {
        const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
        const { lastLoginTime } = await SecureStorage.getSessionMetadata();
        await SecureStorage.setSessionMetadata(
          expiresAt.toISOString(),
          typeof lastLoginTime === 'string' && lastLoginTime !== ''
            ? lastLoginTime
            : new Date().toISOString(),
        );
      });

      Logger.info('[AUTH] Token refresh completed successfully');
      return response;
    } catch (error) {
      // ✅ OFFLINE-FIRST: Use WARN instead of ERROR for token refresh failures
      // Network errors are expected and shouldn't spam error logs
      Logger.warn('Token refresh failed (will be handled by middleware)', {
        error: error instanceof Error ? error.message : String(error),
      });
      void ErrorHandler.handle(error as Error, { operation: 'refreshToken' });

      // Extract message from AppError or Error
      let errorMessage = 'Token refresh failed';
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Determine if this is a network error (offline/timeout) vs auth error (401/403)
      const isNetworkError =
        errorMessage === 'Network request failed' ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('econnrefused') ||
        errorMessage.toLowerCase().includes('econnaborted') ||
        (error !== null &&
          typeof error === 'object' &&
          'type' in error &&
          (error as { type: string }).type === 'NETWORK');

      return rejectWithValue({
        message: errorMessage,
        isNetworkError,
      });
    }
  },
);

/**
 * Logout Async Thunk
 *
 * ✅ PRODUCTION-GRADE:
 * - Cancels inflight requests before logout
 * - Only calls API for explicit user logout with valid token
 * - Always clears local state (even if API fails)
 * - Idempotent with promise-based lock
 *
 * @param params.reason - Why logout is happening (user_action | session_expired | token_missing)
 */
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (
    params: { reason?: 'user_action' | 'session_expired' | 'token_missing' } = {},
    { getState },
  ) => {
    // ✅ PROMISE LOCK: Prevent concurrent logout calls
    if (logoutLock !== null) {
      Logger.info('[AUTH] Logout already in progress, waiting for completion');
      await logoutLock;
      return; // Logout already completed by another call
    }

    // Snapshot state before async operations
    const state = getState() as { auth: AuthState };
    const { isAuthenticated, user } = state.auth;
    const userId = user?.userId;
    // Read access token from Keychain — never from Redux state
    const accessToken = await SecureStorage.getAccessToken();
    const reason = params.reason ?? 'user_action';

    // Create logout promise and store as lock
    logoutLock = (async () => {
      try {
        Logger.info('[AUTH] Logout started', { userId, reason });

        // ✅ CRITICAL: Cancel all inflight requests FIRST
        // Prevents orphaned requests from re-triggering auth flows
        const { cancelInflightRequests } = await import('@/services/requestCancellation');
        cancelInflightRequests();

        // ✅ CRITICAL: Clear TanStack Query cache to prevent stale data on account switch
        const { queryClient } = await import('@/lib/react-query/queryClient');
        queryClient.clear();

        // ✅ BEST PRACTICE: Only call logout API for explicit user action with valid token
        // Don't call API if:
        // - Session expired (token already invalid → would get 401)
        // - Token missing (no session to invalidate)
        // - Not authenticated (no active session)
        const logoutToken =
          accessToken !== null && accessToken !== undefined && accessToken !== ''
            ? accessToken
            : null;
        const shouldCallApi = reason === 'user_action' && isAuthenticated && logoutToken !== null;

        if (shouldCallApi) {
          try {
            Logger.info('[AUTH] Calling logout API (user-initiated)', { userId });
            await authService.logout(logoutToken);
            Logger.info('[AUTH] Logout API successful', { userId });
          } catch (error) {
            // ✅ GRACEFUL DEGRADATION: API failure doesn't stop local logout
            Logger.warn(
              '[AUTH] Logout API failed, clearing local state anyway',
              { userId, reason },
              error as Error,
            );
          }
        } else {
          Logger.info('[AUTH] Skipping logout API call (local-only)', {
            userId,
            reason,
            shouldCallApi: false,
          });
        }

        // ✅ ALWAYS clear local state (even if API fails)
        await SecureStorage.clearAll();

        Logger.info('[AUTH] Logout completed', { userId, reason, calledApi: shouldCallApi });
      } catch (error) {
        Logger.error('[AUTH] Logout failed (unexpected)', { userId, reason }, error as Error);

        // Still try to clear storage
        await SecureStorage.clearAll().catch(storageError => {
          Logger.error('[AUTH] Failed to clear secure storage', {}, storageError as Error);
        });
      } finally {
        // Clear lock
        logoutLock = null;
      }
    })();

    // Wait for logout to complete
    await logoutLock;
  },
);

/**
 * Delete Account Async Thunk
 *
 * Self-service account deletion:
 * - Calls DELETE /auth/me API
 * - Cancels inflight requests
 * - Clears all local storage (Keychain)
 * - Resets auth state → state-driven nav redirects to login
 *
 * On failure: keeps user logged in, surfaces error message.
 */
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

      // Clear TanStack Query cache
      const { queryClient } = await import('@/lib/react-query/queryClient');
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

export const loadStoredAuthAsync = createAsyncThunk(
  'auth/loadStoredAuth',
  async (_, { rejectWithValue }) => {
    try {
      Logger.debug('Loading stored authentication data');

      // Migrate from AsyncStorage to Keychain if needed (one-time migration)
      await SecureStorage.migrateFromAsyncStorage();

      // Parallel reads: tokens, user data, and session metadata are independent
      const [{ accessToken, refreshToken }, userJson, { expiresAt, lastLoginTime }] =
        await Promise.all([
          SecureStorage.getTokensWithRetry(3),
          SecureStorage.getUserData(),
          SecureStorage.getSessionMetadata(),
        ]);

      Logger.info('[Auth] Loaded from Keychain', { hasTokens: !!(accessToken && refreshToken) });

      // Explicitly check for null/undefined or empty strings to avoid nullable conditional usage
      const isAccessTokenMissing = accessToken == null || accessToken === '';
      const isRefreshTokenMissing = refreshToken == null || refreshToken === '';
      const isUserJsonMissing = userJson == null || userJson === '';

      if (isAccessTokenMissing || isRefreshTokenMissing || isUserJsonMissing) {
        Logger.debug('No stored authentication data found');
        return null;
      }

      const parsedUser = JSON.parse(userJson) as unknown;
      const user = parsedUser as User;

      // Check if the access token has expired on disk.
      // NOTE: We intentionally do NOT clear storage or return null here.
      // The refresh token may still be valid (it has a much longer TTL).
      // flowState=AUTHENTICATED is set in the reducer; the reactive 401 handler in
      // apiClient silently exchanges the stale access token for a new one on
      // the first API call — completely transparent to the user.
      // If the refresh token is also expired, apiClient dispatches forceLocalLogout
      // which clears storage and sets flowState=SESSION_EXPIRED.
      if (typeof expiresAt === 'string' && expiresAt !== '') {
        const expiresAtDate = new Date(expiresAt);
        if (expiresAtDate <= new Date()) {
          Logger.info('[Auth] Access token expired on cold start — will refresh transparently', {
            expiresAt,
          });
          // Fall through: tokens stay in Keychain; reactive refresh handles renewal.
        }
      }

      Logger.info('Stored authentication data loaded successfully', { userId: user.userId });
      return {
        user,
        lastLoginTime,
        sessionExpiresAt: expiresAt,
      };
    } catch (error) {
      Logger.error('Failed to load stored authentication data', {}, error as Error);

      // Clear corrupted data
      await SecureStorage.clearAll();

      return rejectWithValue({
        message: 'Failed to load stored authentication data',
      });
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
          (error as { type: string }).type === 'NETWORK');

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
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: state => {
      state.error = undefined;
    },

    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload } as User;
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // STATE-DRIVEN NAVIGATION: Manual flow state transitions
    setFlowState: (state, action: PayloadAction<AuthFlowState>) => {
      state.flowState = action.payload;
      Logger.debug('[STATE-DRIVEN NAV] Manual flow state change', { flowState: action.payload });
    },

    // Transition from email verification to login (phone verification deferred)
    emailVerified: state => {
      if (state.user) {
        state.user = { ...state.user, isEmailVerified: true };
        // Phone verification now happens when placing an order, not during registration
        state.flowState = AuthFlowState.UNAUTHENTICATED;
        state.pendingVerificationEmail = undefined;
        // Clear user data, they need to login now
        state.user = null;
      }
    },

    // Transition from phone verification to login
    phoneVerified: state => {
      if (state.user) {
        state.user = { ...state.user, isPhoneVerified: true };
        state.flowState = AuthFlowState.UNAUTHENTICATED;
        state.pendingVerificationPhone = undefined;
        // Clear user data, they need to login now
        state.user = null;
      }
    },

    /**
     * RESILIENT AUTH: Set network error state (keep session, show banner)
     * Called by apiClient when network errors occur (500, timeout, DNS)
     * NEVER triggers logout - session is preserved
     */
    setNetworkError: (
      state,
      action: PayloadAction<{
        isOffline: boolean;
        message: string;
        retryAfterMs?: number;
      }>,
    ) => {
      state.isOffline = action.payload.isOffline;
      state.offlineMessage = action.payload.message;
      state.retryAfterMs = action.payload.retryAfterMs;
      state.offlineSince = new Date().toISOString();
      Logger.info('[AUTH] Entered offline mode (session preserved)', {
        message: action.payload.message,
        retryAfterMs: action.payload.retryAfterMs,
      });
    },

    /**
     * RESILIENT AUTH: Clear network error state (connection restored)
     * Called when network connection is restored
     */
    clearNetworkError: state => {
      state.isOffline = false;
      state.offlineMessage = undefined;
      state.retryAfterMs = undefined;
      state.offlineSince = undefined;
      Logger.info('[AUTH] Exited offline mode (connection restored)');
    },

    /**
     * Mark that post-resume token recovery has started.
     * Protected query hooks use this flag to wait for refresh before firing.
     */
    sessionRecoveryStarted: state => {
      state.isRecoveringSession = true;
    },

    /**
     * Clear the recovery flag once checkAndRefreshToken has resolved
     * (success OR fatal failure). The flag must always be cleared so
     * queries don't stay gated forever.
     */
    sessionRecoveryFinished: state => {
      state.isRecoveringSession = false;
    },

    /**
     * CRITICAL: Force local logout WITHOUT making any API call
     * Used by apiClient interceptor when token refresh fails
     * This prevents infinite loop: 401 → refresh fail → logout API → 401 → ...
     */
    forceLocalLogout: () => {
      // ✅ CRITICAL: Reset logout lock to allow future logout attempts
      logoutLock = null;
      return {
        ...initialState,
        flowState: AuthFlowState.SESSION_EXPIRED,
      };
    },
  },
  extraReducers: builder => {
    // Login
    builder.addCase(loginAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(loginAsync.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = undefined;

      if (action.payload.requiresMFA === true) {
        // MFA required, don't set user/tokens yet
        state.flowState = AuthFlowState.MFA_REQUIRED;
        state.mfaToken = action.payload.mfaToken;
        return;
      }

      if (action.payload.user?.requiresPasswordChange === true) {
        // Admin-created account: route driver to force-change-password screen
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.flowState = AuthFlowState.PASSWORD_CHANGE_REQUIRED;
        return;
      }

      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();

      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // STATE-DRIVEN NAVIGATION: User is fully authenticated
      state.flowState = AuthFlowState.AUTHENTICATED;
      // Clear any pending verification data
      state.pendingVerificationEmail = undefined;
      state.pendingVerificationPhone = undefined;
      state.mfaToken = undefined;
      state.isUserSynced = true;
    });

    builder.addCase(loginAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== '' ? payload.message : 'Login failed';
      state.isAuthenticated = false;
      state.user = null;
      state.flowState = AuthFlowState.UNAUTHENTICATED;
    });

    // Google Sign-In
    // NOTE: isLoading is NOT set here. GoogleSignInButton manages its own
    // local loading state — setting Redux isLoading would leak the spinner
    // into the Register/Login form buttons that share the same selector.
    builder.addCase(googleSignInAsync.pending, state => {
      state.error = undefined;
    });

    builder.addCase(googleSignInAsync.fulfilled, (state, action) => {
      state.error = undefined;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();
      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();
      state.flowState = AuthFlowState.AUTHENTICATED;
      state.pendingVerificationEmail = undefined;
      state.pendingVerificationPhone = undefined;
      state.mfaToken = undefined;
      state.isUserSynced = true;
    });

    builder.addCase(googleSignInAsync.rejected, (state, action) => {
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'Google Sign-In failed';
      state.isAuthenticated = false;
      state.user = null;
      state.flowState = AuthFlowState.UNAUTHENTICATED;
    });

    // Register
    builder.addCase(registerAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(registerAsync.fulfilled, (state, action) => {
      // Registration successful - user needs to verify email before they can log in
      // The backend does NOT return tokens on registration, only on login
      // Store the user data temporarily so VerifyEmail screen can access it
      // User must verify email first, then login to get authenticated
      state.isLoading = false;
      state.error = undefined;
      state.user = action.payload.user as User; // Store unverified user data
      state.isAuthenticated = false; // User is not logged in yet

      // STATE-DRIVEN NAVIGATION: Set flow state to trigger navigation
      // RootNavigator will detect this and automatically show VerifyEmail screen
      state.flowState = AuthFlowState.REGISTRATION_PENDING;
      state.pendingVerificationEmail =
        typeof action.payload.user.email === 'string' && action.payload.user.email !== ''
          ? action.payload.user.email
          : undefined;
    });

    builder.addCase(registerAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      const errorMessage =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'Registration failed';

      // DON'T set global error for field-level validation errors
      // These are handled inline by the RegisterScreen component
      const isFieldLevelError =
        errorMessage.toLowerCase().includes('email') ||
        errorMessage.toLowerCase().includes('phone') ||
        errorMessage.toLowerCase().includes('password');

      if (!isFieldLevelError) {
        // Only set global error for general registration failures
        state.error = errorMessage;
      } else {
        // Clear any previous global error for field-level errors
        state.error = undefined;
      }

      // DON'T change flowState - keep user on register screen to see the error
      // flowState should remain as UNAUTHENTICATED (or whatever it was before)
      // Navigation back to login should only happen via explicit user action
    });

    // Email Verification with Auto-Login
    builder.addCase(verifyEmailAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(verifyEmailAsync.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = undefined;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();

      const expiresAt = new Date(Date.now() + (action.payload.tokens.expiresIn || 3600) * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // STATE-DRIVEN NAVIGATION: Email verified AND auto-logged in
      // User goes directly to Home screen (not Login)
      state.flowState = AuthFlowState.AUTHENTICATED;
      state.pendingVerificationEmail = undefined;
      state.isUserSynced = true;
    });

    builder.addCase(verifyEmailAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'Email verification failed';
      // Keep current flowState so user can retry or request new link
    });

    // MFA Verification
    builder.addCase(verifyMFAAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(verifyMFAAsync.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = undefined;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();

      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // STATE-DRIVEN NAVIGATION: MFA verified, user is authenticated
      state.flowState = AuthFlowState.AUTHENTICATED;
      state.mfaToken = undefined;
      state.isUserSynced = true;
    });

    builder.addCase(verifyMFAAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'MFA verification failed';
      // Keep in MFA_REQUIRED state so user can retry
    });

    // Token Refresh
    builder.addCase(refreshTokenAsync.pending, state => {
      // Don't set isLoading here to avoid UI flickering during background refresh
      state.error = undefined;
    });

    builder.addCase(refreshTokenAsync.fulfilled, (state, action) => {
      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // CRITICAL FIX: Restore authenticated state after successful token refresh
      // This fixes the race condition where loadStoredAuthAsync clears the session
      // but the refresh token (still in memory) successfully refreshes
      state.isAuthenticated = true;
      state.flowState = AuthFlowState.AUTHENTICATED;
    });

    builder.addCase(refreshTokenAsync.rejected, (state, action) => {
      const payload = action.payload as { message?: string; isNetworkError?: boolean } | undefined;

      if (payload?.isNetworkError === true) {
        // NETWORK ERROR: Device offline or server unreachable.
        // Keep the session alive — the user is still authenticated.
        // The offline banner (driven by NetInfo) handles the UX.
        state.isOffline = true;
        state.offlineMessage =
          "No connection. Your session is safe — we'll retry when you're back online.";
        state.error = undefined;
      } else {
        // AUTH ERROR (401/403/invalid token): Session truly expired.
        state.user = null;
        state.isAuthenticated = false;
        state.error = 'Session expired. Please login again.';
        state.flowState = AuthFlowState.SESSION_EXPIRED;

        Logger.info('[STATE-DRIVEN NAV] Session expired', {
          flowState: AuthFlowState.SESSION_EXPIRED,
        });
      }
    });

    // Logout
    builder.addCase(logoutAsync.pending, state => {
      state.isLoading = true;
    });

    builder.addCase(logoutAsync.fulfilled, () => {
      // Reset to initial state but with UNAUTHENTICATED flow state
      // (not INITIALIZING, which would cause navigator to have no screens)
      // NOTE: Location and favorites slices listen for this action and clear themselves
      Logger.info('[STATE-DRIVEN NAV] Logout successful', {
        flowState: AuthFlowState.UNAUTHENTICATED,
      });
      return {
        ...initialState,
        flowState: AuthFlowState.UNAUTHENTICATED,
      };
    });

    builder.addCase(logoutAsync.rejected, () => {
      // Even if logout API fails, clear local state
      // Set UNAUTHENTICATED flow state to redirect to login
      Logger.info('[STATE-DRIVEN NAV] Logout failed but clearing state', {
        flowState: AuthFlowState.UNAUTHENTICATED,
      });
      return {
        ...initialState,
        flowState: AuthFlowState.UNAUTHENTICATED,
      };
    });

    // Delete Account
    builder.addCase(deleteAccountAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(deleteAccountAsync.fulfilled, () => {
      Logger.info('[STATE-DRIVEN NAV] Account deleted', {
        flowState: AuthFlowState.UNAUTHENTICATED,
      });
      return {
        ...initialState,
        flowState: AuthFlowState.UNAUTHENTICATED,
      };
    });

    builder.addCase(deleteAccountAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'Failed to delete account';
    });

    // Load Stored Auth
    builder.addCase(loadStoredAuthAsync.pending, state => {
      state.isLoading = true;
      state.isUserSynced = false;
    });

    builder.addCase(loadStoredAuthAsync.fulfilled, (state, action) => {
      state.isLoading = false;

      if (action.payload) {
        // Guard: tokens were found in Keychain but user data is null/corrupt
        // (can happen when JSON.stringify(null) was stored, or the fire-and-forget
        // Keychain write in loginAsync did not complete before the app was killed).
        // Treat this as unauthenticated so we don't persist an inconsistent state
        // to MMKV and trigger the RehydrationOrchestrator validation error on next boot.
        if (!action.payload.user) {
          state.user = null;
          state.isAuthenticated = false;
          state.flowState = AuthFlowState.UNAUTHENTICATED;

          Logger.warn('[STATE-DRIVEN NAV] Tokens found but user data is null — clearing session', {
            flowState: AuthFlowState.UNAUTHENTICATED,
          });
          return;
        }

        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.lastLoginTime = action.payload.lastLoginTime;
        state.sessionExpiresAt = action.payload.sessionExpiresAt;

        // STATE-DRIVEN NAVIGATION: Restored authenticated session
        state.flowState = AuthFlowState.AUTHENTICATED;

        Logger.info('[STATE-DRIVEN NAV] Session restored', {
          flowState: AuthFlowState.AUTHENTICATED,
        });
      } else {
        // No stored auth data
        state.flowState = AuthFlowState.UNAUTHENTICATED;

        Logger.info('[STATE-DRIVEN NAV] No stored session', {
          flowState: AuthFlowState.UNAUTHENTICATED,
        });
      }
    });

    builder.addCase(loadStoredAuthAsync.rejected, state => {
      state.isLoading = false;
      state.flowState = AuthFlowState.UNAUTHENTICATED;
      // Keep initial state
    });

    // Sync Current User (cold-start /auth/me)
    builder.addCase(syncCurrentUserAsync.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isUserSynced = true;
      Logger.info('[AUTH] User data synced from server', { userId: action.payload.userId });
    });

    builder.addCase(syncCurrentUserAsync.rejected, (state, action) => {
      const payload = action.payload as
        | { isNetworkError?: boolean; isServerError?: boolean; isAuthError?: boolean }
        | undefined;

      if (payload?.isAuthError === true) {
        // 401/403: interceptor will handle logout — don't touch isUserSynced
        return;
      }

      // Network errors, 5xx server errors, or any other failure:
      // trust cached data, don't leave the flag stuck at false
      state.isUserSynced = true;
    });

    // Update Profile
    builder.addCase(updateProfileAsync.pending, state => {
      state.isLoading = true;
      state.error = undefined;
    });

    builder.addCase(updateProfileAsync.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = undefined;
      state.user = action.payload;

      Logger.info('[Profile] Profile updated in Redux state', { userId: action.payload.userId });
    });

    builder.addCase(updateProfileAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'Failed to update profile';

      Logger.error('[Profile] Profile update failed', {}, new Error(state.error));
    });
  },
});

export const {
  clearError,

  updateUser,

  forceLocalLogout,

  setFlowState,

  sessionRecoveryStarted,
  sessionRecoveryFinished,
} = authSlice.actions;
export default authSlice.reducer;

// ── Named selectors (co-located with slice per Redux best practices) ──
// Use individual field selectors instead of `state.auth` to prevent
// re-renders when unrelated auth fields change (e.g. sessionExpiresAt refresh).

/** Primitive boolean — no createSelector needed (returns stable ref). */
export const selectIsPhoneVerified = (state: RootState): boolean =>
  state.auth.user?.isPhoneVerified ?? false;

export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthIsLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthFlowState = (state: RootState) => state.auth.flowState;
export const selectIsRecoveringSession = (state: RootState): boolean =>
  state.auth.isRecoveringSession;
export const selectIsUserSynced = (state: RootState): boolean => state.auth.isUserSynced;
