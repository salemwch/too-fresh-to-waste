// Authentication Types

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { UserRole } from '@foodwaste/shared';

export type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  RegisterResponse,
  MFAVerificationRequest,
  RefreshTokenRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  EmailVerificationRequest,
  EmailVerificationConfirmRequest,
  PhoneVerificationRequest,
  PhoneVerificationConfirmRequest,
  PhoneVerificationResponse,
} from '@foodwaste/shared';

// Backward-compatible alias: mobile uses PasswordResetRequest, shared uses ForgotPasswordRequest
export type { ForgotPasswordRequest as PasswordResetRequest } from '@foodwaste/shared';

import type { UserResponse } from '@foodwaste/shared';

/**
 * Mobile-friendly alias with readonly semantics.
 * Existing mobile code uses `User` everywhere — this preserves that contract.
 */
export type User = Readonly<UserResponse>;

// ============================================================================
// Mobile-only types (state machine, forms, sessions)
// ============================================================================

// Auth Flow State Machine
// This enum represents the user's journey through the auth flow
export enum AuthFlowState {
  // Initial states
  INITIALIZING = 'initializing', // App is loading, checking stored auth
  UNAUTHENTICATED = 'unauthenticated', // No user session, show login/register

  // Registration flow states
  REGISTRATION_PENDING = 'registration_pending', // User registered, needs email verification
  EMAIL_VERIFICATION_PENDING = 'email_verification_pending', // Verifying email
  PHONE_VERIFICATION_PENDING = 'phone_verification_pending', // Email verified, needs phone verification

  // Login flow states
  MFA_REQUIRED = 'mfa_required', // User logged in, needs MFA verification
  PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED', // Admin-created account: must set new password on first login

  // Password reset flow states
  PASSWORD_RESET_REQUESTED = 'password_reset_requested', // User requested password reset
  PASSWORD_RESET_VERIFIED = 'password_reset_verified', // Reset token verified, can set new password

  // Authenticated states
  AUTHENTICATED = 'authenticated', // Fully authenticated and verified, show main app
  SESSION_EXPIRED = 'session_expired', // Session expired, needs re-authentication
  ACCOUNT_SUSPENDED = 'account_suspended', // Admin suspended/blocked the account
}

// Auth State Types
export interface AuthState {
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: string | undefined;
  readonly lastLoginTime: string | null;
  readonly sessionExpiresAt: string | null;

  // State-driven navigation: determines which screen to show
  readonly flowState: AuthFlowState;

  // Temporary data for auth flows (cleared after flow completes)
  readonly pendingVerificationEmail?: string | undefined; // Email waiting for verification
  readonly pendingVerificationPhone?: string | undefined; // Phone waiting for verification
  readonly mfaToken?: string | undefined; // Temporary MFA token
  readonly passwordResetToken?: string | undefined; // Temporary password reset token

  // NOTE: offline state deliberately does not live here. Connectivity is owned
  // by utils/offlineManager.ts (NetInfo-driven), which is what OfflineBanner and
  // the session middleware actually read. A parallel set of Redux offline fields
  // used to exist alongside it — written on a failed refresh, never read, and
  // with no reachable way to clear them. Resilient auth still holds: a refresh
  // that fails for network reasons leaves the session untouched.

  // True while the session middleware is running post-resume token recovery.
  // Protected queries should wait on this flag before firing so they don't
  // race the refresh and trigger a 401 flood.
  readonly isRecoveringSession: boolean;

  // True once the app has fetched fresh user data from GET /auth/me on
  // cold start (or received fresh data via login/register/verifyEmail).
  // ProtectedRoute defers the email-verification gate until this is true
  // so stale Keychain data doesn't falsely block the user.
  readonly isUserSynced: boolean;
}
