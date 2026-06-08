import axios, { type AxiosError, type AxiosResponse } from 'axios';

import { environment } from '@/config/environment';
import { ErrorHandler, ErrorType } from '@/utils/errorHandler';
import { Logger, NetworkLogger } from '@/utils/logger';

import type {
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  RegisterResponse,
  MFAVerificationRequest,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  EmailVerificationRequest,
  EmailVerificationConfirmRequest,
  PhoneVerificationRequest,
  PhoneVerificationConfirmRequest,
  PhoneVerificationResponse,
  User,
  AuthTokens,
} from '../types';
import type { ApiResponse } from '@foodwaste/shared';

class AuthService {
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor() {
    this.baseURL = `${environment.api.baseUrl}/auth`;
    this.timeout = environment.api.timeout;
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>,
    customBaseURL?: string,
  ): Promise<T> {
    const baseURL = customBaseURL ?? this.baseURL;
    const url = `${baseURL}${endpoint}`;
    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, method, headers);

      const response: AxiosResponse<ApiResponse<T>> = await axios({
        method,
        url,
        data,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Platform': 'mobile',
          'X-App-Version': environment.app.version,
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'FoodWasteApp/1.0',
          ...headers,
        },
        timeout: this.timeout,
      });

      const duration = Date.now() - startTime;
      NetworkLogger.logResponse(url, response.status, duration);

      return response.data.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleRequestError(error, url, duration);
      throw error; // TypeScript guard (handleRequestError always throws)
    }
  }

  /**
   * Centralized error handler - delegates to specific handlers
   * Cognitive Complexity: 3
   */
  private handleRequestError(error: unknown, url: string, duration: number): never {
    if (axios.isAxiosError(error)) {
      NetworkLogger.logResponse(url, error.response?.status ?? 0, duration);
      this.handleHttpError(error);
    }

    this.handleNetworkError(error, url);
  }

  /**
   * HTTP status code error handler
   * Cognitive Complexity: 6 (linear switch-like logic)
   */
  private handleHttpError(
    error: AxiosError<unknown>, // Use 'unknown' instead of 'any' for better type safety
  ): never {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // Backend global exception filter returns: { statusCode, message, errorId, timestamp... }
    // Extract message with defensive handling to ensure it's always a string
    let message: string = 'Request failed';

    if (responseData !== null && responseData !== undefined) {
      if (typeof responseData === 'string') {
        // Response is a plain string
        message = responseData;
      } else if (typeof responseData === 'object') {
        const dataObj = responseData as Record<string, unknown>;

        if (typeof dataObj['message'] === 'string') {
          // Standard case: { message: "error text" }
          message = dataObj['message'];
        } else if (Array.isArray(dataObj['message'])) {
          // class-validator array: items are strings OR { property, constraints } objects
          message = (dataObj['message'] as unknown[])
            .map(item => {
              if (typeof item === 'string') return item;
              if (item !== null && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                if (obj['constraints'] !== null && typeof obj['constraints'] === 'object') {
                  return Object.values(obj['constraints'] as Record<string, string>)[0] ?? '';
                }
              }
              return '';
            })
            .filter(Boolean)
            .join(', ');
        } else if (
          dataObj['message'] !== null &&
          dataObj['message'] !== undefined &&
          typeof dataObj['message'] === 'object'
        ) {
          // Nested message object: { message: { message: "error text" } }
          const nestedMsg = dataObj['message'] as Record<string, unknown>;
          if (typeof nestedMsg['message'] === 'string') {
            message = nestedMsg['message'];
          } else if (typeof nestedMsg['error'] === 'string') {
            message = nestedMsg['error'];
          } else {
            message = JSON.stringify(dataObj['message']);
          }
        } else if (typeof dataObj['error'] === 'string') {
          // Alternative error property
          message = dataObj['error'];
        }
      }
    }

    Logger.debug('[authService] HTTP error extracted', { message, status });

    if (status === 401) {
      // Preserve field-specific error information from backend for inline error display
      const errorMetadata: Record<string, unknown> = {
        code: status,
      };

      if (responseData !== null && responseData !== undefined && typeof responseData === 'object') {
        const dataObj = responseData as Record<string, unknown>;

        // Check for field/type at top level first (for direct error objects)
        if (typeof dataObj['field'] === 'string') {
          errorMetadata['field'] = dataObj['field'];
        }
        if (typeof dataObj['type'] === 'string') {
          errorMetadata['errorCode'] = dataObj['type']; // Rename to errorCode to avoid conflict with ErrorType
        }

        // Also check nested message object (for wrapped error responses)
        if (
          dataObj['message'] !== null &&
          dataObj['message'] !== undefined &&
          typeof dataObj['message'] === 'object'
        ) {
          const nestedMsg = dataObj['message'] as Record<string, unknown>;
          if (typeof nestedMsg['field'] === 'string') {
            errorMetadata['field'] = nestedMsg['field'];
          }
          if (typeof nestedMsg['type'] === 'string') {
            errorMetadata['errorCode'] = nestedMsg['type']; // Rename to errorCode to avoid conflict with ErrorType
          }
        }
      }

      Logger.debug('[authService] 401 error metadata', errorMetadata);

      throw ErrorHandler.createError(
        ErrorType.AUTHENTICATION,
        message ?? 'Authentication failed',
        errorMetadata,
      );
    }

    if (status === 403) {
      // Check if this is an account lockout error with blockedUntil timestamp
      const errorMetadata: Record<string, unknown> = {
        code: status,
      };

      if (responseData !== null && responseData !== undefined && typeof responseData === 'object') {
        const dataObj = responseData as Record<string, unknown>;

        // Extract blockedUntil timestamp for account lockout errors
        if (
          typeof dataObj['blockedUntil'] === 'string' ||
          dataObj['blockedUntil'] instanceof Date
        ) {
          errorMetadata['blockedUntil'] = dataObj['blockedUntil'];
          errorMetadata['isAccountLocked'] = true;
        }

        // Also check nested message object
        if (
          dataObj['message'] !== null &&
          dataObj['message'] !== undefined &&
          typeof dataObj['message'] === 'object'
        ) {
          const nestedMsg = dataObj['message'] as Record<string, unknown>;
          if (
            typeof nestedMsg['blockedUntil'] === 'string' ||
            nestedMsg['blockedUntil'] instanceof Date
          ) {
            errorMetadata['blockedUntil'] = nestedMsg['blockedUntil'];
            errorMetadata['isAccountLocked'] = true;
          }
        }
      }

      Logger.debug('[authService] 403 error metadata', errorMetadata);

      throw ErrorHandler.createError(
        ErrorType.PERMISSION,
        message ?? 'Permission denied',
        errorMetadata,
      );
    }

    if (status === 404) {
      throw ErrorHandler.createError(ErrorType.NOT_FOUND, message ?? 'Resource not found', {
        code: status,
      });
    }

    if (status === 422) {
      const errorMetadata: { code: number; validationErrors?: Record<string, string> } = {
        code: status,
      };
      if (responseData !== null && responseData !== undefined && typeof responseData === 'object') {
        const dataObj = responseData as Record<string, unknown>;
        if (dataObj['errors'] !== undefined && typeof dataObj['errors'] === 'object') {
          errorMetadata.validationErrors = dataObj['errors'] as Record<string, string>;
        }
      }
      throw ErrorHandler.createError(
        ErrorType.VALIDATION,
        message ?? 'Validation failed',
        errorMetadata,
      );
    }

    if (status !== undefined && status >= 500) {
      throw ErrorHandler.createError(ErrorType.SERVER_ERROR, 'Server is currently unavailable', {
        code: status,
      });
    }

    if (status !== undefined && status >= 400) {
      // Extract field-level validation errors from class-validator response
      const validationErrors: Record<string, string> = {};
      if (responseData !== null && responseData !== undefined && typeof responseData === 'object') {
        const dataObj = responseData as Record<string, unknown>;
        if (Array.isArray(dataObj['message'])) {
          for (const item of dataObj['message'] as unknown[]) {
            if (item !== null && typeof item === 'object') {
              const obj = item as Record<string, unknown>;
              const prop = typeof obj['property'] === 'string' ? obj['property'] : null;
              if (
                prop !== null &&
                obj['constraints'] !== null &&
                typeof obj['constraints'] === 'object'
              ) {
                const first = Object.values(obj['constraints'] as Record<string, string>)[0];
                if (first !== undefined && first !== '') validationErrors[prop] = first;
              }
            }
          }
        }
      }
      throw ErrorHandler.createError(ErrorType.CLIENT_ERROR, message, {
        code: status,
        ...(Object.keys(validationErrors).length > 0 ? { validationErrors } : {}),
      });
    }

    // Axios error without response (network issue)
    throw ErrorHandler.createError(ErrorType.NETWORK, 'Network request failed', {
      originalError: error,
    });
  }

  /**
   * Network and timeout error handler
   * Cognitive Complexity: 4
   */
  private handleNetworkError(error: unknown, url: string): never {
    const errorCode = (error as { code?: string }).code;
    const errorMessage = error instanceof Error ? error.message : '';

    if (errorCode === 'ECONNABORTED' || errorMessage.includes('timeout')) {
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        'Request timeout. Please check your connection and try again.',
        error instanceof Error ? { originalError: error } : {},
      );
    }

    if (errorCode === 'NETWORK_ERROR' || !navigator.onLine) {
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        'No internet connection. Please check your network and try again.',
        error instanceof Error ? { originalError: error } : {},
      );
    }

    NetworkLogger.logError(url, error as Error);

    throw ErrorHandler.createError(
      ErrorType.UNKNOWN,
      error instanceof Error ? error.message : 'An unexpected error occurred',
      error instanceof Error ? { originalError: error } : {},
    );
  }

  // Authentication methods
  public async login(request: LoginRequest): Promise<LoginResponse> {
    Logger.info('Attempting user login', { email: request.email });

    try {
      const response = await this.makeRequest<LoginResponse>('POST', '/login', {
        email: request.email,
        password: request.password,
        rememberMe: request.rememberMe,
      });

      Logger.info('Login successful', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('Login failed', { email: request.email }, error as Error);
      throw error;
    }
  }

  public async googleSignIn(idToken: string, referralCode?: string): Promise<LoginResponse> {
    Logger.info('Attempting Google Sign-In', {
      ...(referralCode ? { referralCode } : {}),
    });

    try {
      const response = await this.makeRequest<LoginResponse>('POST', '/google', {
        idToken,
        ...(referralCode ? { referralCode } : {}),
      });
      Logger.info('Google Sign-In successful', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('Google Sign-In failed', {}, error as Error);
      throw error;
    }
  }

  public async register(request: RegisterRequest): Promise<RegisterResponse> {
    Logger.info('Attempting user registration', { email: request.email });

    // Role hardcoded to 'consumer' - merchants register via website
    const response = await this.makeRequest<RegisterResponse>('POST', '/register', {
      email: request.email,
      password: request.password,
      firstName: request.firstName,
      lastName: request.lastName,
      phoneNumber: request.phoneNumber,
      role: 'consumer',
      ...(request.referralCode ? { referralCode: request.referralCode } : {}),
    });

    Logger.info('Registration successful', { userId: response.user.userId });
    return response;
  }

  public async verifyMFA(request: MFAVerificationRequest): Promise<LoginResponse> {
    Logger.info('Attempting MFA verification');

    const response = await this.makeRequest<LoginResponse>('POST', '/mfa/verify', {
      mfaToken: request.mfaToken,
      code: request.code,
    });

    Logger.info('MFA verification successful', { userId: response.user.userId });
    return response;
  }

  public async refreshToken(request: RefreshTokenRequest): Promise<{ tokens: AuthTokens }> {
    Logger.debug('Attempting token refresh');

    const response = await this.makeRequest<{ tokens: AuthTokens }>('POST', '/refresh', {
      refreshToken: request.refreshToken,
    });

    Logger.debug('Token refresh successful');
    return response;
  }

  public async logout(accessToken?: string): Promise<void> {
    Logger.info('Attempting logout');

    // Pass authorization header if token is available
    // This ensures the backend can properly invalidate the session
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    await this.makeRequest<void>('POST', '/logout', undefined, headers);

    Logger.info('Logout successful');
  }

  // Password management
  public async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    Logger.info('Requesting password reset', { email: request.email });

    await this.makeRequest<void>('POST', '/forgot-password', {
      email: request.email,
    });

    Logger.info('Password reset request sent', { email: request.email });
  }

  public async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<void> {
    Logger.info('Confirming password reset');

    await this.makeRequest<void>('POST', '/reset-password', {
      email: request.email,
      token: request.token,
      newPassword: request.newPassword,
    });

    Logger.info('Password reset confirmed');
  }

  public async changePassword(request: ChangePasswordRequest, accessToken: string): Promise<void> {
    Logger.info('Attempting password change');

    await this.makeRequest<void>(
      'POST',
      '/change-password',
      {
        currentPassword: request.currentPassword,
        newPassword: request.newPassword,
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    Logger.info('Password changed successfully');
  }

  // Email verification
  public async requestEmailVerification(request: EmailVerificationRequest): Promise<void> {
    Logger.info('Requesting email verification', { email: request.email });

    await this.makeRequest<void>('POST', '/resend-verification', {
      email: request.email,
    });

    Logger.info('Email verification request sent', { email: request.email });
  }

  public async confirmEmailVerification(request: EmailVerificationConfirmRequest): Promise<void> {
    Logger.info('Confirming email verification');

    await this.makeRequest<void>('POST', '/verify-email', {
      email: request.email,
      token: request.token,
    });

    Logger.info('Email verification confirmed');
  }

  /**
   * Verify email with token and auto-login
   * Returns tokens for automatic authentication (no separate login required)
   */
  public async verifyEmail(request: { email?: string; token: string }): Promise<LoginResponse> {
    Logger.info('Verifying email with auto-login');

    // email is @IsOptional() on the backend — omit it when absent to avoid
    // class-validator @IsEmail() rejection on an empty string.
    const body: Record<string, string> = { token: request.token };
    if (request.email) body['email'] = request.email;

    const response = await this.makeRequest<LoginResponse>('POST', '/verify-email', body);

    Logger.info('Email verified with auto-login successful', { userId: response.user?.userId });
    return response;
  }

  // User profile
  public async getCurrentUser(accessToken: string): Promise<User> {
    Logger.debug('Fetching current user profile');

    const response = await this.makeRequest<User>('GET', '/me', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    Logger.debug('Current user profile fetched', { userId: response.userId });
    return response;
  }

  public async updateProfile(updates: Partial<User>, accessToken: string): Promise<User> {
    Logger.info('Updating user profile');

    const response = await this.makeRequest<User>(
      'PATCH',
      '/profile',
      updates,
      {
        Authorization: `Bearer ${accessToken}`,
      },
      `${environment.api.baseUrl}/users`,
    );

    Logger.info('User profile updated', { userId: response.userId });
    return response;
  }

  // Session management
  public async getSessions(accessToken: string): Promise<Session[]> {
    Logger.debug('Fetching user sessions');

    const response = await this.makeRequest<Session[]>('GET', '/sessions', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    Logger.debug('User sessions fetched', { sessionCount: response.length });
    return response;
  }

  public async terminateSession(sessionId: string, accessToken: string): Promise<void> {
    Logger.info('Terminating session', { sessionId });

    await this.makeRequest<void>('POST', `/terminate-session/${sessionId}`, undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    Logger.info('Session terminated', { sessionId });
  }

  public async terminateAllSessions(accessToken: string): Promise<void> {
    Logger.info('Terminating all sessions');

    await this.makeRequest<void>('POST', '/logout-all', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    Logger.info('All sessions terminated');
  }

  // Account deletion
  public async deleteAccount(accessToken: string): Promise<void> {
    Logger.info('Attempting account deletion');

    await this.makeRequest<void>('DELETE', '/me', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    Logger.info('Account deletion completed');
  }

  // Convenience methods for better naming consistency
  public async forgotPassword(email: string): Promise<void> {
    return this.requestPasswordReset({ email });
  }

  public async resendVerificationEmail(email: string): Promise<void> {
    return this.requestEmailVerification({ email });
  }

  // Phone verification
  public async sendPhoneVerification(
    request: PhoneVerificationRequest,
    accessToken: string,
  ): Promise<PhoneVerificationResponse> {
    Logger.info('Sending phone verification code', { phoneNumber: request.phoneNumber });

    const response = await this.makeRequest<PhoneVerificationResponse>(
      'POST',
      '/phone/verify-request',
      {
        phoneNumber: request.phoneNumber,
        method: request.method ?? 'sms',
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
      `${environment.api.baseUrl}/users`,
    );

    Logger.info('Phone verification code sent', { phoneNumber: request.phoneNumber });
    return response;
  }

  public async confirmPhoneVerification(
    request: PhoneVerificationConfirmRequest,
    accessToken: string,
  ): Promise<PhoneVerificationResponse> {
    Logger.info('Verifying phone number', { phoneNumber: request.phoneNumber });

    const response = await this.makeRequest<PhoneVerificationResponse>(
      'POST',
      '/phone/verify',
      {
        phoneNumber: request.phoneNumber,
        code: request.code,
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
      `${environment.api.baseUrl}/users`,
    );

    Logger.info('Phone verification successful', { phoneNumber: request.phoneNumber });
    return response;
  }

  public async resendPhoneVerification(
    request: PhoneVerificationRequest,
    accessToken: string,
  ): Promise<PhoneVerificationResponse> {
    Logger.info('Resending phone verification code', { phoneNumber: request.phoneNumber });

    const response = await this.makeRequest<PhoneVerificationResponse>(
      'POST',
      '/phone/resend-code',
      {
        phoneNumber: request.phoneNumber,
        method: request.method ?? 'sms',
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
      `${environment.api.baseUrl}/users`,
    );

    Logger.info('Phone verification code resent', { phoneNumber: request.phoneNumber });
    return response;
  }
}

interface Session {
  readonly id: string;
  readonly deviceInfo: {
    readonly platform: string;
    readonly version: string;
    readonly deviceId: string;
    readonly appVersion: string;
  };
  readonly lastActivity: string;
  readonly createdAt: string;
  readonly isActive: boolean;
}

// Create and export singleton instance
export const authService = new AuthService();
