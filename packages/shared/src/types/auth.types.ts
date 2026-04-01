import { UserRole } from '../enums/user.enum';
import type { UserResponse } from './user.types';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  captchaToken?: string;
}

export interface BusinessInfo {
  name: string;
  googlePlaceId: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  addressComponents?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  types?: string[];
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role?: UserRole;
  businessInfo?: BusinessInfo;
  privacyConsents?: {
    dataProcessingConsent: boolean;
    locationTrackingConsent: boolean;
    communicationConsent: boolean;
    marketingConsent?: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Login/verify-email response — mirrors backend LoginResponse.
 * `user` uses the same shape as SafeUserResponse.
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  user: UserResponse;
  tokens: AuthTokens;
  requiresMFA?: boolean;
  mfaToken?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: Partial<UserResponse>;
}

export interface MFAVerificationRequest {
  mfaToken: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface EmailVerificationRequest {
  email: string;
}

/** Alias for VerifyEmailRequest — same shape, different naming convention */
export type EmailVerificationConfirmRequest = VerifyEmailRequest;

export interface PhoneVerificationRequest {
  phoneNumber: string;
  method?: 'sms' | 'voice';
}

export interface PhoneVerificationConfirmRequest {
  phoneNumber: string;
  code: string;
}

export interface PhoneVerificationResponse {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordStrengthResponse {
  score: number;
  feedback: string[];
  isStrong: boolean;
}
