import { apiClient } from '@/lib/api-client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  RefreshTokenRequest,
  PasswordStrengthResponse,
  ApiResponse,
  UserResponse,
} from '@foodwaste/shared';

const AUTH_BASE = '/auth';

export const authService = {
  login(data: LoginRequest) {
    return apiClient.post<ApiResponse<LoginResponse>>(`${AUTH_BASE}/login`, data);
  },

  register(data: RegisterRequest) {
    return apiClient.post<ApiResponse<RegisterResponse>>(`${AUTH_BASE}/register`, data);
  },

  verifyEmail(data: VerifyEmailRequest) {
    return apiClient.post<ApiResponse<LoginResponse>>(`${AUTH_BASE}/verify-email`, data);
  },

  resendVerification(email: string) {
    return apiClient.post<ApiResponse<void>>(`${AUTH_BASE}/resend-verification`, { email });
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return apiClient.post<ApiResponse<void>>(`${AUTH_BASE}/forgot-password`, data);
  },

  resetPassword(data: ResetPasswordRequest) {
    return apiClient.post<ApiResponse<void>>(`${AUTH_BASE}/reset-password`, data);
  },

  refresh(data: RefreshTokenRequest) {
    return apiClient.post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
      `${AUTH_BASE}/refresh`,
      data,
    );
  },

  logout() {
    return apiClient.post<ApiResponse<void>>(`${AUTH_BASE}/logout`);
  },

  getProfile() {
    return apiClient.get<ApiResponse<UserResponse>>(`${AUTH_BASE}/me`);
  },

  getPasswordPolicy() {
    return apiClient.get<
      ApiResponse<{
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireNumbers: boolean;
        requireSpecialChars: boolean;
      }>
    >(`${AUTH_BASE}/password-policy`);
  },

  checkPasswordStrength(password: string) {
    return apiClient.post<ApiResponse<PasswordStrengthResponse>>(
      `${AUTH_BASE}/check-password-strength`,
      { password },
    );
  },
};
