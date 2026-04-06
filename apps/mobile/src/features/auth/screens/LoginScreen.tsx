/**
 * Login Screen
 * User authentication with email/password, MFA support, and remember me
 */

import { yupResolver } from '@hookform/resolvers/yup';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';

import LeafLogo from '@/assets/images/leaf.png';
import WavingHand from '@/assets/images/waving-hand.png';
import { Input, Text, Card, Icon } from '@/design-system/components/atoms';
import {
  ResendVerificationModal,
  AccountLockedModal,
  MorphingButton,
} from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { getErrorMessage, isAppError } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';
import { showSuccessToast } from '@/utils/toast';
import { loginSchema, type LoginFormData } from '@/utils/validation/schemas';

import { authService } from '../services/authService';
import { loginAsync, clearError } from '../store/authSlice';

import type { LoginScreenNavigationProp } from '@/navigation/types';
import type { TextInput } from 'react-native';

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

/**
 * Parse backend validation errors from NestJS class-validator
 * Backend returns: { message: { message: [{ property: 'email', constraints: {...} }] } }
 */
interface BackendValidationError {
  property: string;
  constraints: Record<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isBackendValidationError = (value: unknown): value is BackendValidationError =>
  isRecord(value) &&
  typeof value['property'] === 'string' &&
  isRecord(value['constraints']) &&
  Object.values(value['constraints']).every(constraint => typeof constraint === 'string');

function parseBackendValidationError(error: unknown): Record<string, string> | null {
  try {
    // Handle nested message structure from backend
    let errorData: unknown = error;
    if (
      isRecord(error) &&
      'response' in error &&
      isRecord(error['response']) &&
      'data' in error['response']
    ) {
      errorData = (error['response'] as { data: unknown }).data;
    }
    let validationErrors: BackendValidationError[] = [];

    // Try to extract validation errors from various backend response formats
    if (
      isRecord(errorData) &&
      'message' in errorData &&
      isRecord(errorData['message']) &&
      Array.isArray(errorData['message']['message'])
    ) {
      validationErrors = errorData['message']['message'].filter(isBackendValidationError);
    } else if (
      isRecord(errorData) &&
      'message' in errorData &&
      Array.isArray(errorData['message'])
    ) {
      validationErrors = errorData['message'].filter(isBackendValidationError);
    }

    // Convert to field-message map
    if (validationErrors.length > 0) {
      const fieldErrors: Record<string, string> = {};
      validationErrors.forEach(err => {
        if (err.property != null && err.constraints != null) {
          // Get first constraint message
          const firstConstraint = Object.values(err.constraints)[0];
          if (firstConstraint !== null && firstConstraint !== undefined && firstConstraint !== '') {
            fieldErrors[err.property] = firstConstraint;
          }
        }
      });
      return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
    }

    return null;
  } catch {
    return null;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector(state => state.auth);

  // React Hook Form setup with Yup validation
  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
    setError,
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    mode: 'onBlur', // Validate on blur for better UX (matches RegisterScreen)
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Watch email for resend verification functionality
  const email = watch('email');

  // Ref for password field — used to focus it when user submits email
  const passwordRef = useRef<TextInput>(null);

  // Show password toggle
  const [showPassword, setShowPassword] = useState(false);

  // Resend verification modal state
  const [showResendModal, setShowResendModal] = useState(false);

  // Email verification state
  const [isEmailUnverified, setIsEmailUnverified] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Account lockout state
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | Date | null>(null);

  // Login success — drives MorphingButton success animation before nav transition
  const [loginSuccess, setLoginSuccess] = useState(false);
  const unverifiedBadgeStyle = {
    backgroundColor: theme.colors.errorContainer,
    borderColor: theme.colors.error,
    shadowColor: theme.colors.onSurface,
  };
  const errorBannerStyle = {
    backgroundColor: theme.colors.errorContainer,
    borderColor: theme.colors.error,
  };
  const resendSectionStyle = {
    borderTopColor: theme.colors.outlineVariant,
  };
  const successBannerStyle = {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.success,
  };

  /**
   * Clear error on component mount
   */
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  /**
   * Detect if login error is due to unverified email
   */
  useEffect(() => {
    if (typeof error === 'string' && error.toLowerCase().includes('verify your email')) {
      setIsEmailUnverified(true);
    } else {
      setIsEmailUnverified(false);
      setResendSuccess(false);
      setResendError(null);
    }
  }, [error]);

  /**
   * Handle form submission (React Hook Form automatically validates)
   */
  const onSubmit = useCallback(
    async (formData: LoginFormData) => {
      try {
        const result = await dispatch(
          loginAsync({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            rememberMe: formData.rememberMe ?? false,
          }),
        ).unwrap();

        // Check if MFA is required
        if (
          result.requiresMFA === true &&
          typeof result.mfaToken === 'string' &&
          result.mfaToken.trim() !== ''
        ) {
          navigation.navigate('MFAVerification', {
            mfaToken: result.mfaToken,
            userId: result.user.userId,
          });
        } else {
          // ✅ SUCCESS: trigger MorphingButton success animation, then show toast
          setLoginSuccess(true);
          const firstName = result.user.firstName || 'User';
          showSuccessToast(`Welcome back, ${firstName}! 🎉`);

          // ✅ Navigation happens automatically via state-driven flow
          // RootNavigator detects flowState = AUTHENTICATED and switches to MainStack
          // No manual navigation needed - RootNavigator now checks auth state FIRST (before onboarding)
          //
          // Flow:
          // 1. loginAsync.fulfilled sets flowState = AUTHENTICATED
          // 2. RootNavigator re-renders (useAppSelector hook detects state change)
          // 3. renderNavigator() checks flowState first (GATE 1)
          // 4. flowState === AUTHENTICATED → returns MainStack screen
          // 5. React Navigation switches from AuthStack to MainStack
          //
          // Why no manual navigation?
          // - State-driven navigation is more reliable (React pattern)
          // - No risk of navigation errors (RESET action not handled)
          // - Easier to test and debug (single source of truth: Redux state)
        }
      } catch (err: unknown) {
        Logger.error('Login error', undefined, err instanceof Error ? err : undefined);
        const errorMessage = getErrorMessage(err, 'Invalid value');
        const appError = isAppError(err) ? err : undefined;

        // Check if this is an account lockout error (403 with blockedUntil)
        if (appError?.isAccountLocked === true && appError.blockedUntil != null) {
          Logger.warn('[LoginScreen] Account locked error detected', {
            blockedUntil: appError.blockedUntil,
            message: appError.message,
          });

          // Show account locked modal instead of inline error
          setBlockedUntil(appError.blockedUntil);
          setShowLockedModal(true);

          // Clear the global error from Redux since we're showing the modal
          dispatch(clearError());
          return;
        }

        // Check if error has field-specific information from backend
        // Backend now returns: { field: 'email' | 'password', type: 'EMAIL_NOT_FOUND' | 'INVALID_PASSWORD' }
        if (appError?.field === 'email' || appError?.field === 'password') {
          // Set inline error on the specific field
          setError(appError.field, {
            type: 'manual',
            message: errorMessage,
          });
          // Clear the global error from Redux since we're showing field-specific error
          dispatch(clearError());
        } else {
          // Try to parse backend validation errors for other cases
          const fieldErrors = parseBackendValidationError(err);
          if (fieldErrors) {
            // Set field-specific errors from backend validation
            Object.entries(fieldErrors).forEach(([field, message]) => {
              if (field === 'email' || field === 'password') {
                setError(field, {
                  type: 'manual',
                  message,
                });
              }
            });
          }
        }
        // Global error is handled by Redux state and displayed in error banner
        // Only shown if no field-specific error was set
      }
    },
    [dispatch, navigation, setError],
  );

  /**
   * Navigate to Register screen
   */
  const handleNavigateToRegister = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  /**
   * Navigate to Forgot Password screen
   */
  const handleNavigateToForgotPassword = useCallback(() => {
    navigation.navigate('ForgotPassword');
  }, [navigation]);

  /**
   * Resend verification email
   */
  const handleResendVerificationEmail = useCallback(async () => {
    if (!email || resendingEmail) return;

    try {
      setResendingEmail(true);
      setResendError(null);
      setResendSuccess(false);

      await authService.resendVerificationEmail(email.trim().toLowerCase());

      setResendSuccess(true);
      setResendError(null);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to send verification email');
      setResendError(errorMessage);
      setResendSuccess(false);
    } finally {
      setResendingEmail(false);
    }
  }, [email, resendingEmail]);

  /**
   * Handle resend verification from modal
   */
  const handleResendFromModal = useCallback(async (emailAddress: string) => {
    await authService.resendVerificationEmail(emailAddress.trim().toLowerCase());
  }, []);

  /**
   * Handle successful verification email send from modal
   */
  const handleResendSuccess = useCallback(
    (emailAddress: string) => {
      setShowResendModal(false);
      navigation.navigate('VerifyEmail', { email: emailAddress });
    },
    [navigation],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Leaf Logo */}
        <View style={styles.header}>
          <Image
            source={LeafLogo}
            style={styles.leafLogo}
            resizeMode='contain'
            accessibilityLabel='Too Fresh To Waste logo'
          />
        </View>

        {/* Login Form Card */}
        <Card style={styles.formCard}>
          {/* Verification Status Badge (Top Right) */}
          {isEmailUnverified && email && (
            <View style={styles.verificationBadge}>
              <View style={[styles.badge, unverifiedBadgeStyle]}>
                <Icon name='close-circle' family='Ionicons' size='sm' color={theme.colors.error} />
                <Text variant='label.small' weight='semibold' style={{ color: theme.colors.error }}>
                  Unverified
                </Text>
              </View>
            </View>
          )}

          {/* Welcome Back Header with Waving Hand */}
          <View style={styles.welcomeHeader}>
            <View style={styles.welcomeTitleRow}>
              <Text variant='headline.large' weight='semibold'>
                Welcome Back
              </Text>
              <Image
                source={WavingHand}
                style={styles.wavingHand}
                resizeMode='contain'
                accessibilityLabel='Waving hand'
              />
            </View>
            <Text variant='body.medium' color='secondary' style={styles.welcomeSubtitle}>
              Save food, save money, save the planet
            </Text>
          </View>

          {/* Global error message from Redux - Displays specific error from backend */}
          {error !== null && error !== undefined && (
            <View style={[styles.errorBanner, errorBannerStyle]}>
              <View style={styles.errorBannerContent}>
                <Icon
                  name='alert-circle-outline'
                  family='Ionicons'
                  size='md'
                  color={theme.colors.error}
                />
                <Text
                  variant='body.small'
                  weight='medium'
                  style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
                >
                  {error}
                </Text>
              </View>

              {/* Resend Verification Email Button (only for unverified email errors) */}
              {isEmailUnverified && email && (
                <View style={[styles.resendSection, resendSectionStyle]}>
                  <Text variant='body.small' color='secondary' style={styles.resendPrompt}>
                    Didn&apos;t receive the email?
                  </Text>
                  <Pressable
                    onPress={() => {
                      void handleResendVerificationEmail();
                    }}
                    disabled={resendingEmail}
                    style={styles.resendButton}
                  >
                    <Text
                      variant='body.small'
                      weight='semibold'
                      style={{
                        color: resendingEmail ? theme.colors.outline : theme.colors.primary,
                      }}
                    >
                      {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Success Message for Resent Email */}
          {resendSuccess && (
            <View style={[styles.successBanner, successBannerStyle]}>
              <Icon
                name='checkmark-circle-outline'
                family='Ionicons'
                size='md'
                color={theme.colors.primary}
              />
              <Text
                variant='body.small'
                weight='medium'
                style={[styles.successText, { color: theme.colors.onPrimaryContainer }]}
              >
                Verification email sent! Check your inbox.
              </Text>
            </View>
          )}

          {/* Error Message for Resend Failure */}
          {typeof resendError === 'string' && resendError.trim() !== '' && (
            <View style={[styles.errorBanner, errorBannerStyle]}>
              <View style={styles.errorBannerContent}>
                <Icon
                  name='alert-circle-outline'
                  family='Ionicons'
                  size='md'
                  color={theme.colors.error}
                />
                <Text
                  variant='body.small'
                  weight='medium'
                  style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
                >
                  {resendError}
                </Text>
              </View>
            </View>
          )}

          {/* Email Input */}
          <Controller
            control={control}
            name='email'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='Email Address'
                placeholder='Enter your email'
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType='email-address'
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='email'
                textContentType='emailAddress'
                returnKeyType='next'
                onSubmitEditing={() => passwordRef.current?.focus()}
                leftIcon={<Icon name='mail-outline' family='Ionicons' size='md' />}
                hasError={!!formErrors.email}
                errorText={formErrors.email?.message}
                editable={!isLoading}
                testID='login-email-input'
                fullWidth
              />
            )}
          />

          {/* Password Input */}
          <Controller
            control={control}
            name='password'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                ref={passwordRef}
                label='Password'
                placeholder='Enter your password'
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='password'
                textContentType='password'
                returnKeyType='done'
                onSubmitEditing={() => void handleSubmit(onSubmit)()}
                leftIcon={<Icon name='lock-closed-outline' family='Ionicons' size='md' />}
                rightIcon={
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Icon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      family='Ionicons'
                      size='md'
                    />
                  </Pressable>
                }
                hasError={!!formErrors.password}
                errorText={formErrors.password?.message}
                editable={!isLoading}
                testID='login-password-input'
                containerStyle={styles.passwordInput}
                fullWidth
              />
            )}
          />

          {/* Remember Me & Forgot Password Row */}
          <Controller
            control={control}
            name='rememberMe'
            render={({ field: { onChange, value } }) => (
              <View style={styles.optionsRow}>
                <Pressable
                  style={styles.rememberMeContainer}
                  onPress={() => onChange(!Boolean(value))}
                  disabled={isLoading}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: theme.colors.outline,
                        backgroundColor:
                          value === true ? theme.colors.primary : theme.colors.surface,
                      },
                    ]}
                  >
                    {value === true && (
                      <Text style={[styles.checkboxCheckmark, { color: theme.colors.onPrimary }]}>
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text variant='body.small' color='secondary'>
                    Remember me
                  </Text>
                </Pressable>

                <Pressable onPress={handleNavigateToForgotPassword} disabled={isLoading}>
                  <Text variant='body.small' color='primary' weight='medium'>
                    Forgot Password?
                  </Text>
                </Pressable>
              </View>
            )}
          />

          {/* Login Button */}
          <MorphingButton
            label='Sign In'
            successLabel='Welcome!'
            loading={isLoading}
            success={loginSuccess}
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
            style={styles.loginButton}
            testID='login-submit-button'
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
            <Text variant='body.small' color='secondary' style={styles.dividerText}>
              OR
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
          </View>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text variant='body.medium' color={theme.colors.onSurfaceVariant}>
              Don&apos;t have an account?{' '}
            </Text>
            <Pressable onPress={handleNavigateToRegister} disabled={isLoading}>
              <Text
                variant='body.medium'
                color={theme.colors.primary}
                weight='semibold'
                style={[styles.signUpText, { textDecorationColor: theme.colors.primary }]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Resend Verification Link */}
          <View style={styles.verificationLinkContainer}>
            <Text variant='body.small' color={theme.colors.onSurfaceVariant}>
              Need to verify email?{' '}
            </Text>
            <Pressable onPress={() => setShowResendModal(true)} disabled={isLoading}>
              <Text
                variant='body.small'
                color={theme.colors.primary}
                weight='semibold'
                style={[styles.verificationLinkText, { textDecorationColor: theme.colors.primary }]}
              >
                Resend Link
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Footer */}
        <Text variant='body.small' color='secondary' align='center' style={styles.footer}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>

      {/* Resend Verification Modal */}
      <ResendVerificationModal
        visible={showResendModal}
        onDismiss={() => setShowResendModal(false)}
        onSuccess={handleResendSuccess}
        onSendVerification={handleResendFromModal}
      />

      {/* Account Locked Modal */}
      {blockedUntil !== null && blockedUntil !== undefined && (
        <AccountLockedModal
          visible={showLockedModal}
          blockedUntil={blockedUntil}
          onDismiss={() => {
            setShowLockedModal(false);
            setBlockedUntil(null);
          }}
          onPasswordReset={handleNavigateToForgotPassword}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  leafLogo: {
    width: 80,
    height: 100,
    transform: [{ scale: 2 }],
  },
  formCard: {
    padding: 24,
    marginBottom: 16,
    position: 'relative',
  },
  verificationBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    transform: [{ rotate: '3deg' }], // Slight tilt for visual interest
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wavingHand: {
    width: 28,
    height: 28,
  },
  welcomeSubtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
  },
  resendSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  resendPrompt: {
    marginBottom: 6,
  },
  resendButton: {
    paddingVertical: 4,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  successText: {
    flex: 1,
  },
  passwordInput: {
    marginTop: 0,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheckmark: {
    fontSize: 14,
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  loginButton: {
    marginBottom: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    textDecorationLine: 'underline',
    // textDecorationColor is set inline using theme.colors.primary for dynamic theming
  },
  verificationLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  verificationLinkText: {
    textDecorationLine: 'underline',
    // textDecorationColor is set inline using theme.colors.primary for dynamic theming
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
