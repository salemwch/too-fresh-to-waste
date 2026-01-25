import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';

import { SecureStorage } from '@/services/SecureStorage';
import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { authService } from '../services/authService';
import { AuthFlowState } from '../types';

import type {
  AuthState,
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  MFAVerificationRequest,
} from '../types';

// Initial state
const initialState: AuthState = {
  user: null,
  tokens: null,
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
};

// Async thunks
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (request: LoginRequest, { rejectWithValue }) => {
    try {
      Logger.info('Login attempt started', { email: request.email });
      const response = await authService.login(request);

      // Store tokens securely in Keychain
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Store user data and session metadata
      await SecureStorage.setUserData(JSON.stringify(response.user));

      const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
      await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());

      Logger.info('Login successful', { userId: response.user.userId });
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

      // Check if error has field/errorCode/lockout metadata (from backend authentication errors)
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['field'] === 'string') {
          errorPayload.field = errObj['field'];
        }
        if (typeof errObj['errorCode'] === 'string') {
          errorPayload.type = errObj['errorCode']; // Map errorCode to type for backward compatibility
        }
        // Preserve account lockout metadata
        if (errObj['isAccountLocked'] === true) {
          errorPayload.isAccountLocked = true;
        }
        if (errObj['blockedUntil'] !== null && errObj['blockedUntil'] !== undefined) {
          errorPayload.blockedUntil = errObj['blockedUntil'];
        }
      }

      console.log('[authSlice] Login error payload:', errorPayload);

      return rejectWithValue(errorPayload);
    }
  },
);

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (request: RegisterRequest, { rejectWithValue }) => {
    try {
      console.log('===== REDUX THUNK: registerAsync started =====');
      Logger.info('Registration attempt started', { email: request.email });
      console.log('AuthSlice: Calling authService.register()...');

      const response = await authService.register(request);

      console.log('AuthSlice: authService.register() returned:', response);
      console.log('AuthSlice: Response structure check:', {
        hasSuccess: 'success' in response,
        hasMessage: 'message' in response,
        hasUser: 'user' in response,
        success: response.success,
        message: response.message,
        userId: response.user?.userId,
      });

      Logger.info('Registration successful', { userId: response.user.userId });
      console.log('===== REDUX THUNK: registerAsync returning success =====');
      return response;
    } catch (error) {
      console.log('===== REDUX THUNK: registerAsync caught error =====');
      console.error('AuthSlice: Registration error caught:', error);
      console.error('AuthSlice: Error type:', typeof error);

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

      const errorPayload = {
        message: errorMessage,
      };
      console.log('AuthSlice: Rejecting with value:', errorPayload);
      console.log('===== REDUX THUNK: registerAsync returning rejection =====');
      return rejectWithValue(errorPayload);
    }
  },
);

export const verifyEmailAsync = createAsyncThunk(
  'auth/verifyEmail',
  async (request: { email: string; token: string }, { rejectWithValue }) => {
    try {
      Logger.info('Email verification attempt started', { email: request.email });
      const response = await authService.verifyEmail(request);

      // Store tokens securely in Keychain (same as login)
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Store user data and session metadata
      await SecureStorage.setUserData(JSON.stringify(response.user));

      const expiresAt = new Date(Date.now() + (response.tokens.expiresIn || 3600) * 1000);
      await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());

      Logger.info('Email verification successful with auto-login', {
        userId: response.user.userId,
      });
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

      // Store tokens securely in Keychain
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Store user data and session metadata
      await SecureStorage.setUserData(JSON.stringify(response.user));

      const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
      await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());

      Logger.info('MFA verification successful', { userId: response.user.userId });
      return response;
    } catch (error) {
      Logger.error('MFA verification failed', {}, error as Error);
      ErrorHandler.handle(error as Error, { operation: 'verifyMFA' });

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
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const refreshToken = state.auth.tokens?.refreshToken;

      if (refreshToken == null || refreshToken === '') {
        throw new Error('No refresh token available');
      }

      Logger.debug('Token refresh attempt started');
      const response = await authService.refreshToken({ refreshToken });

      // Update stored tokens in Keychain
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
      const { lastLoginTime } = await SecureStorage.getSessionMetadata();
      await SecureStorage.setSessionMetadata(
        expiresAt.toISOString(),
        typeof lastLoginTime === 'string' && lastLoginTime !== ''
          ? lastLoginTime
          : new Date().toISOString(),
      );

      Logger.debug('Token refresh successful');
      return response;
    } catch (error) {
      Logger.error('Token refresh failed', {}, error as Error);
      ErrorHandler.handle(error as Error, { operation: 'refreshToken' });

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

      return rejectWithValue({
        message: errorMessage,
      });
    }
  },
);

export const logoutAsync = createAsyncThunk('auth/logout', async (_, { getState }) => {
  try {
    const state = getState() as { auth: AuthState };
    const userId = state.auth.user?.userId;

    Logger.info('Logout attempt started', { userId });

    // Call logout API to invalidate server-side session
    await authService.logout();

    // Clear all stored auth data from Keychain and AsyncStorage
    await SecureStorage.clearAll();

    Logger.info('Logout successful', { userId });
  } catch (error) {
    Logger.error('Logout failed', {}, error as Error);

    // Even if logout API fails, clear local storage
    await SecureStorage.clearAll();

    throw error;
  }
});

export const loadStoredAuthAsync = createAsyncThunk(
  'auth/loadStoredAuth',
  async (_, { rejectWithValue }) => {
    try {
      Logger.debug('Loading stored authentication data');

      // Migrate from AsyncStorage to Keychain if needed (one-time migration)
      await SecureStorage.migrateFromAsyncStorage();

      // Load tokens from secure storage
      const { accessToken, refreshToken } = await SecureStorage.getTokens();
      const userJson = await SecureStorage.getUserData();
      const { expiresAt, lastLoginTime } = await SecureStorage.getSessionMetadata();

      // Explicitly check for null/undefined or empty strings to avoid nullable conditional usage
      const isAccessTokenMissing = accessToken == null || accessToken === '';
      const isRefreshTokenMissing = refreshToken == null || refreshToken === '';
      const isUserJsonMissing = userJson == null || userJson === '';

      if (isAccessTokenMissing || isRefreshTokenMissing || isUserJsonMissing) {
        Logger.debug('No stored authentication data found');
        return null;
      }

      const user: User = JSON.parse(userJson);
      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: 3600, // Default, will be updated on refresh
        tokenType: 'Bearer',
      };

      // Check if session is expired
      if (typeof expiresAt === 'string' && expiresAt !== '') {
        const expiresAtDate = new Date(expiresAt);
        if (expiresAtDate <= new Date()) {
          Logger.info('Stored session expired', { expiresAt });
          // Clear expired data
          await SecureStorage.clearAll();
          return null;
        }
      }

      Logger.info('Stored authentication data loaded successfully', { userId: user.userId });
      return {
        user,
        tokens,
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

export const updateProfileAsync = createAsyncThunk(
  'auth/updateProfile',
  async (
    updates: Partial<Omit<User, 'userId' | 'email' | 'role' | 'createdAt' | 'updatedAt'>>,
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as { auth: AuthState };
      const accessToken = state.auth.tokens?.accessToken;

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

    updateTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
      const expiresAt = new Date(Date.now() + action.payload.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();
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
      console.log('[STATE-DRIVEN NAV] Manual flow state change:', action.payload);
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

        console.log(
          '[STATE-DRIVEN NAV] Email verified, flowState =',
          AuthFlowState.UNAUTHENTICATED,
        );
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

        console.log(
          '[STATE-DRIVEN NAV] Phone verified, flowState =',
          AuthFlowState.UNAUTHENTICATED,
        );
      }
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
        console.log(
          '[STATE-DRIVEN NAV] Login requires MFA, flowState =',
          AuthFlowState.MFA_REQUIRED,
        );
        return;
      }

      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
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

      console.log('[STATE-DRIVEN NAV] Login successful, flowState =', AuthFlowState.AUTHENTICATED);
    });

    builder.addCase(loginAsync.rejected, (state, action) => {
      state.isLoading = false;
      const payload = action.payload as { message?: string } | undefined;
      state.error =
        payload?.message != null && payload.message !== '' ? payload.message : 'Login failed';
      state.isAuthenticated = false;
      state.user = null;
      state.tokens = null;
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

      console.log(
        '[STATE-DRIVEN NAV] Registration complete, flowState =',
        AuthFlowState.REGISTRATION_PENDING,
      );
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
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();

      const expiresAt = new Date(Date.now() + (action.payload.tokens.expiresIn || 3600) * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // STATE-DRIVEN NAVIGATION: Email verified AND auto-logged in
      // User goes directly to Home screen (not Login)
      state.flowState = AuthFlowState.AUTHENTICATED;
      state.pendingVerificationEmail = undefined;

      console.log(
        '[STATE-DRIVEN NAV] Email verified with auto-login, flowState =',
        AuthFlowState.AUTHENTICATED,
      );
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
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.lastLoginTime = new Date().toISOString();

      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();

      // STATE-DRIVEN NAVIGATION: MFA verified, user is authenticated
      state.flowState = AuthFlowState.AUTHENTICATED;
      state.mfaToken = undefined;

      console.log('[STATE-DRIVEN NAV] MFA verified, flowState =', AuthFlowState.AUTHENTICATED);
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
    builder.addCase(refreshTokenAsync.fulfilled, (state, action) => {
      state.tokens = action.payload.tokens;
      const expiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
      state.sessionExpiresAt = expiresAt.toISOString();
    });

    builder.addCase(refreshTokenAsync.rejected, state => {
      // Token refresh failed, user needs to login again
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = 'Session expired. Please login again.';
      state.flowState = AuthFlowState.SESSION_EXPIRED;

      console.log('[STATE-DRIVEN NAV] Session expired, flowState =', AuthFlowState.SESSION_EXPIRED);
    });

    // Logout
    builder.addCase(logoutAsync.pending, state => {
      state.isLoading = true;
    });

    builder.addCase(logoutAsync.fulfilled, () => {
      // Reset to initial state but with UNAUTHENTICATED flow state
      // (not INITIALIZING, which would cause navigator to have no screens)
      console.log('[STATE-DRIVEN NAV] Logout successful, flowState =', AuthFlowState.UNAUTHENTICATED);
      return {
        ...initialState,
        flowState: AuthFlowState.UNAUTHENTICATED,
      };
    });

    builder.addCase(logoutAsync.rejected, () => {
      // Even if logout API fails, clear local state
      // Set UNAUTHENTICATED flow state to redirect to login
      console.log('[STATE-DRIVEN NAV] Logout failed but clearing state, flowState =', AuthFlowState.UNAUTHENTICATED);
      return {
        ...initialState,
        flowState: AuthFlowState.UNAUTHENTICATED,
      };
    });

    // Load Stored Auth
    builder.addCase(loadStoredAuthAsync.pending, state => {
      state.isLoading = true;
    });

    builder.addCase(loadStoredAuthAsync.fulfilled, (state, action) => {
      state.isLoading = false;

      if (action.payload) {
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.lastLoginTime = action.payload.lastLoginTime;
        state.sessionExpiresAt = action.payload.sessionExpiresAt;

        // STATE-DRIVEN NAVIGATION: Restored authenticated session
        state.flowState = AuthFlowState.AUTHENTICATED;

        console.log(
          '[STATE-DRIVEN NAV] Session restored, flowState =',
          AuthFlowState.AUTHENTICATED,
        );
      } else {
        // No stored auth data
        state.flowState = AuthFlowState.UNAUTHENTICATED;

        console.log(
          '[STATE-DRIVEN NAV] No stored session, flowState =',
          AuthFlowState.UNAUTHENTICATED,
        );
      }
    });

    builder.addCase(loadStoredAuthAsync.rejected, state => {
      state.isLoading = false;
      state.flowState = AuthFlowState.UNAUTHENTICATED;
      // Keep initial state
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
  updateTokens,
  updateUser,
  setLoading,
  setFlowState,
  emailVerified,
  phoneVerified,
} = authSlice.actions;
export default authSlice.reducer;
