// Authentication Types

// UserRole — single source of truth from shared package
export { UserRole } from '@foodwaste/shared';
import { UserRole } from '@foodwaste/shared';

export interface User {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly role: UserRole;
  readonly status?: string;
  readonly isEmailVerified: boolean;
  readonly isPhoneVerified: boolean;
  readonly avatar?: string;
  readonly profileImage?: string;
  readonly address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    coordinates?: {
      type: string;
      coordinates: [number, number];
    };
  };
  readonly locationPreferences?: {
    defaultLocation?: {
      latitude: number;
      longitude: number;
    };
    searchRadius?: number;
    autoDetectLocation?: boolean;
    shareLocation?: boolean;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastLoginAt?: string;
}

// UserRole enum is re-exported from @foodwaste/shared above.

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: 'Bearer';
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly rememberMe?: boolean;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly role: UserRole;
  readonly privacyConsents?: {
    dataProcessingConsent: boolean;
    locationTrackingConsent: boolean;
    communicationConsent: boolean;
    marketingConsent?: boolean;
  };
}

export interface LoginResponse {
  readonly user: User;
  readonly tokens: AuthTokens;
  readonly requiresMFA?: boolean;
  readonly mfaToken?: string;
}

export interface RegisterResponse {
  readonly success: boolean;
  readonly message: string;
  readonly user: Partial<User>;
}

export interface MFAVerificationRequest {
  readonly mfaToken: string;
  readonly code: string;
}

export interface RefreshTokenRequest {
  readonly refreshToken: string;
}

export interface PasswordResetRequest {
  readonly email: string;
}

export interface PasswordResetConfirmRequest {
  readonly email: string;
  readonly token: string;
  readonly newPassword: string;
}

export interface ChangePasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface EmailVerificationRequest {
  readonly email: string;
}

export interface EmailVerificationConfirmRequest {
  readonly email: string;
  readonly token: string;
}

export interface PhoneVerificationRequest {
  readonly phoneNumber: string;
  readonly method?: 'sms' | 'voice';
}

export interface PhoneVerificationConfirmRequest {
  readonly phoneNumber: string;
  readonly code: string;
}

export interface PhoneVerificationResponse {
  readonly success: boolean;
  readonly message: string;
  readonly attemptsRemaining?: number;
}

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
