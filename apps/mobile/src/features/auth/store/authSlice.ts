/**
 * Auth slice — the reducers that drive navigation.
 *
 * `flowState` is what RootNavigator switches on, so the transitions below are
 * the app's navigation state machine. They are kept here, together, for that
 * reason; the eleven thunks that call the network live in ./thunks and are
 * re-exported from this module so every existing import path still resolves.
 *
 * Layout:
 *   authState.ts  — initialState + the mobile role gate
 *   logoutLock.ts — the shared single-flight logout lock
 *   thunks/       — network calls, grouped by concern
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { Logger } from '@/utils/logger';

import { AuthFlowState } from '../types';

import { initialState, MOBILE_ALLOWED_ROLES } from './authState';
import { logoutLock } from './logoutLock';
import {
  loginAsync,
  googleSignInAsync,
  registerAsync,
  verifyEmailAsync,
  verifyMFAAsync,
  refreshTokenAsync,
  logoutAsync,
  deleteAccountAsync,
  loadStoredAuthAsync,
  syncCurrentUserAsync,
  updateProfileAsync,
} from './thunks';

import type { User } from '../types';
import type { RootState } from '@/store';

import { isRegisterFieldError, type RegisterFailure } from '../utils/registerErrors';
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

    // STATE-DRIVEN NAVIGATION: Manual flow state transitions
    setFlowState: (state, action: PayloadAction<AuthFlowState>) => {
      state.flowState = action.payload;
      Logger.debug('[STATE-DRIVEN NAV] Manual flow state change', { flowState: action.payload });
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
      logoutLock.current = null;
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
      // The thunk always supplies a key, so the fallback is for a rejection
      // that bypassed it (an unhandled throw inside the thunk itself). A key
      // here too, so no path can put raw English on screen.
      state.error =
        payload?.message != null && payload.message !== ''
          ? payload.message
          : 'auth.googleSignInFailed';
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
      const failure = (action.payload ?? {}) as RegisterFailure;

      // Field errors are shown inline by RegisterScreen; only a failure that
      // belongs to no field goes to the global banner. Decided by the error
      // code - the message is translated, so searching it for "email" only
      // ever worked in English.
      state.error = isRegisterFieldError(failure)
        ? undefined
        : (failure.message ?? 'register.registrationFailed');

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
      const payload = action.payload as
        { message?: string; isNetworkError?: boolean; isAccountSuspended?: boolean } | undefined;

      if (payload?.isNetworkError === true) {
        // NETWORK/SERVER ERROR: Device offline, server unreachable, or 5xx.
        // Deliberately a no-op on the session — the user is still
        // authenticated, we just could not reach the server. The offline
        // banner (NetInfo, via utils/offlineManager) owns the UX; clearing
        // `error` keeps a stale auth error from outliving the outage.
        state.error = undefined;
      } else if (payload?.isAccountSuspended === true) {
        // ACCOUNT SUSPENDED: Admin action — show specific screen, not login.
        state.user = null;
        state.isAuthenticated = false;
        state.error = 'Your account has been suspended. Please contact support.';
        state.flowState = AuthFlowState.ACCOUNT_SUSPENDED;

        Logger.info('[STATE-DRIVEN NAV] Account suspended', {
          flowState: AuthFlowState.ACCOUNT_SUSPENDED,
        });
      } else {
        // AUTH ERROR (401/invalid token): Session truly expired.
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

        if (!MOBILE_ALLOWED_ROLES.has(action.payload.user.role)) {
          state.user = null;
          state.isAuthenticated = false;
          state.flowState = AuthFlowState.UNAUTHENTICATED;
          state.error =
            'This account cannot be used on the mobile app. Please use the web dashboard.';
          Logger.warn('[AUTH] Blocked rehydration for non-mobile role', {
            role: action.payload.user.role,
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
      if (!MOBILE_ALLOWED_ROLES.has(action.payload.role)) {
        state.user = null;
        state.isAuthenticated = false;
        state.flowState = AuthFlowState.UNAUTHENTICATED;
        state.error =
          'This account cannot be used on the mobile app. Please use the web dashboard.';
        Logger.warn('[AUTH] Role changed to non-mobile role — forcing logout', {
          role: action.payload.role,
        });
        return;
      }
      state.user = action.payload;
      state.isUserSynced = true;
      Logger.info('[AUTH] User data synced from server', { userId: action.payload.userId });
    });

    builder.addCase(syncCurrentUserAsync.rejected, (state, action) => {
      const payload = action.payload as
        { isNetworkError?: boolean; isServerError?: boolean; isAuthError?: boolean } | undefined;

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

// ── Re-exports ───────────────────────────────────────────────────────────────
// The thunks moved to ./thunks during the split. Re-exported here so every
// existing import of '@/features/auth/store/authSlice' keeps working — the
// split is meant to be invisible to callers.
export {
  loginAsync,
  googleSignInAsync,
  registerAsync,
  verifyEmailAsync,
  verifyMFAAsync,
  refreshTokenAsync,
  logoutAsync,
  deleteAccountAsync,
  loadStoredAuthAsync,
  syncCurrentUserAsync,
  updateProfileAsync,
};
