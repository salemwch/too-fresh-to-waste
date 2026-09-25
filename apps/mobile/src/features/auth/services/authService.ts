import axios, { type AxiosError, type AxiosResponse } from 'axios';

import { environment } from '@/config/environment';
import i18n, { getCurrentLanguage } from '@/i18n';
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
import { readApiError } from '@foodwaste/shared';
import type { ApiResponse } from '@foodwaste/shared';

/** First argument that is a non-empty string. */
function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}

function pickDate(...values: unknown[]): string | Date | undefined {
  for (const value of values) {
    if ((typeof value === 'string' && value !== '') || value instanceof Date) return value;
  }
  return undefined;
}

/** Field errors in the pre-code shape: class-validator items in `message`. */
function legacyFieldErrors(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(body['message'])) return out;
  for (const item of body['message'] as unknown[]) {
    if (item === null || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const constraints = obj['constraints'];
    if (
      typeof obj['property'] === 'string' &&
      constraints !== null &&
      typeof constraints === 'object'
    ) {
      const first = Object.values(constraints as Record<string, string>)[0];
      if (first) out[obj['property']] = first;
    }
  }
  return out;
}

/** The app-level category of an HTTP failure. */
function errorTypeFor(status: number | undefined, code: string | undefined): ErrorType {
  if (status === undefined) return ErrorType.NETWORK;
  if (status >= 500) return ErrorType.SERVER_ERROR;
  if (status === 401) return ErrorType.AUTHENTICATION;
  if (status === 403) return ErrorType.PERMISSION;
  if (status === 404) return ErrorType.NOT_FOUND;
  if (status === 422 || code === 'VALIDATION_FAILED') return ErrorType.VALIDATION;
  return ErrorType.CLIENT_ERROR;
}

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
          // The backend answers errors in this language. These calls go through
          // bare axios, not apiClient, so they must send it themselves.
          'Accept-Language': getCurrentLanguage(),
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

      // Only an error carrying a response is an HTTP error. Without one there
      // is no status for handleHttpError to branch on, so it fell through to
      // its final `throw NETWORK, 'Network request failed'` and every timeout
      // came out labelled a connectivity problem. That made handleNetworkError's
      // timeout branch unreachable for HTTP calls, and the UI told users to
      // check their internet while the server was simply still waking up.
      if (error.response !== undefined) {
        this.handleHttpError(error);
      }
    }

    this.handleNetworkError(error, url);
  }

  /**
   * HTTP status code error handler.
   *
   * The backend sends `{ code, message, details?, errors? }`, with `message`
   * already in the app's language (makeRequest sends Accept-Language). This
   * keeps that message, and hands screens the `code` (as `errorCode`) to
   * branch on - never the text, which is translated and may change.
   *
   * Older response shapes (top-level `field` / `type` / `blockedUntil`, and
   * class-validator arrays in `message`) are still read, so an app released
   * before the backend deploy keeps working against the old API.
   */
  private handleHttpError(error: AxiosError<unknown>): never {
    const status = error.response?.status;
    const body = error.response?.data;
    const info = readApiError(body);
    const legacy =
      body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    const field = pickString(info.details['field'], legacy['field']);
    const errorCode = pickString(info.code, info.details['type'], legacy['type']);
    const blockedUntil = pickDate(info.details['blockedUntil'], legacy['blockedUntil']);
    const validationErrors =
      Object.keys(info.fieldErrors).length > 0 ? info.fieldErrors : legacyFieldErrors(legacy);

    const metadata = {
      ...(status !== undefined ? { code: status } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(field ? { field } : {}),
      ...(blockedUntil ? { blockedUntil, isAccountLocked: true } : {}),
      ...(Object.keys(validationErrors).length > 0 ? { validationErrors } : {}),
    };

    Logger.debug('[authService] HTTP error', { status, errorCode, errorId: info.errorId });

    const serverError = status !== undefined && status >= 500;
    // A translated fallback only for a response with no message at all
    // (a proxy error page, an empty body); the backend always sends one.
    const message = info.message ?? i18n.t(serverError ? 'errors.serverError' : 'errors.generic');

    throw ErrorHandler.createError(errorTypeFor(status, errorCode), message, metadata);
  }

  /**
   * Network and timeout error handler
   * Cognitive Complexity: 4
   */
  private handleNetworkError(error: unknown, url: string): never {
    const errorCode = (error as { code?: string }).code;
    const errorMessage = error instanceof Error ? error.message : '';

    // The request left the device and nothing came back in time. The server is
    // reachable, it is just slow - a cold start on Render answers in ~54s
    // against a 15s client timeout - so telling the user to check their
    // internet is both wrong and unactionable. `errorCode` is what callers
    // branch on; the message is a developer-facing fallback.
    if (
      errorCode === 'ECONNABORTED' ||
      errorCode === 'ETIMEDOUT' ||
      errorMessage.toLowerCase().includes('timeout')
    ) {
      // `errorCode` is what the sign-in thunks branch on to pick a translation.
      // The message stays a readable English sentence because other screens
      // (VerifyPhone, ResetPassword) render it through `getErrorMessage`
      // untranslated - a bare "Request timed out" would be a downgrade there.
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        'The server is taking longer than usual to respond. Please try again in a moment.',
        {
          errorCode: 'TIMEOUT',
          ...(error instanceof Error ? { originalError: error } : {}),
        },
      );
    }

    // Axios v1 reports a failed connection as ERR_NETWORK. The previous
    // condition also tested `!navigator.onLine`, which React Native does not
    // define - `!undefined` is always true, so this branch swallowed every
    // error that reached it regardless of cause, including the UNKNOWN case
    // below. Match on the code alone.
    if (errorCode === 'ERR_NETWORK' || errorCode === 'NETWORK_ERROR') {
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        'No connection to the server. Check your internet and try again.',
        {
          errorCode: 'OFFLINE',
          ...(error instanceof Error ? { originalError: error } : {}),
        },
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
      ...(request.email ? { email: request.email } : {}),
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
