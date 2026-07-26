/**
 * Auth slice — initial state and role gate.
 *
 * Split out of authSlice.ts so the thunk modules can import the shared pieces
 * without importing the slice itself, which would be a cycle: the slice's
 * extraReducers reference the thunks.
 */

import { UserRole } from '@foodwaste/shared';

import { AuthFlowState } from '../types';

import type { AuthState } from '../types';

export const initialState: AuthState = {
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
  // Post-resume token-recovery gate (see authSessionMiddleware)
  isRecoveringSession: false,
  // Cold-start user sync (fresh data from /auth/me)
  isUserSynced: false,
};

/**
 * Roles permitted to sign in on the mobile app. Merchants, admins and
 * moderators use the web dashboard — letting them authenticate here would drop
 * them into a consumer UI with no route to their own tools.
 */
export const MOBILE_ALLOWED_ROLES = new Set<string>([
  UserRole.CONSUMER,
  UserRole.DRIVER,
  'consumer',
  'driver',
]);

export function assertMobileRole(role: string | undefined): void {
  if (!role || !MOBILE_ALLOWED_ROLES.has(role)) {
    throw Object.assign(
      new Error('This account cannot be used on the mobile app. Please use the web dashboard.'),
      {
        field: 'credentials',
        errorCode: 'ROLE_NOT_ALLOWED',
      },
    );
  }
}
