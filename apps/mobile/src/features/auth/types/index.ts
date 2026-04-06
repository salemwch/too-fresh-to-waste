// Authentication Types

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { UserRole } from '@foodwaste/shared';

export type {
  UserResponse,
  UserAddress,
  UserLocationPreferences,
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

import type { AuthTokens, UserResponse } from '@foodwaste/shared';

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

  // Password reset flow states
  PASSWORD_RESET_REQUESTED = 'password_reset_requested', // User requested password reset
  PASSWORD_RESET_VERIFIED = 'password_reset_verified', // Reset token verified, can set new password

  // Authenticated states
  AUTHENTICATED = 'authenticated', // Fully authenticated and verified, show main app
  SESSION_EXPIRED = 'session_expired', // Session expired, needs re-authentication
}

// Auth State Types
export interface AuthState {
  readonly user: User | null;
  readonly tokens: AuthTokens | null;
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

  // Offline mode (resilient auth - never logout on network errors)
  readonly isOffline: boolean; // Network error detected (500, timeout, DNS failure)
  readonly offlineMessage?: string | undefined; // Message to show in banner ("You're offline. Trying to reconnect…")
  readonly retryAfterMs?: number | undefined; // When to retry connection
  readonly offlineSince?: string | undefined; // When offline mode started (ISO timestamp)
}

export interface BiometricAuthState {
  readonly isEnabled: boolean;
  readonly isSupported: boolean;
  readonly biometricType?: 'TouchID' | 'FaceID' | 'Fingerprint';
}

// Form Validation Types
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  // phoneNumber removed - deferred to order placement
  // role removed - hardcoded to 'consumer' (merchants register via website)
  // Terms and privacy automatically accepted on registration
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

export interface FormState<T> {
  readonly data: T;
  readonly errors: ValidationError[];
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
}

// Social Auth Types
enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

export interface SocialAuthRequest {
  readonly provider: SocialProvider;
  readonly token: string;
}

// Session Management Types
export interface Session {
  readonly id: string;
  readonly deviceInfo: DeviceInfo;
  readonly lastActivity: string;
  readonly createdAt: string;
  readonly isActive: boolean;
}

interface DeviceInfo {
  readonly platform: string;
  readonly version: string;
  readonly deviceId: string;
  readonly appVersion: string;
}

// Security Types
export interface SecuritySettings {
  readonly isMFAEnabled: boolean;
  readonly isBiometricEnabled: boolean;
  readonly loginAttempts: number;
  readonly lastFailedLogin?: string;
  readonly accountLocked: boolean;
  readonly lockoutExpiresAt?: string;
}
