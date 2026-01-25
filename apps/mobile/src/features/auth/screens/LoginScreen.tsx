/**
 * Login Screen
 * User authentication with email/password, MFA support, and remember me
 */

import { yupResolver } from '@hookform/resolvers/yup';
import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';

import LeafLogo from '@/assets/images/leaf.png';
import WavingHand from '@/assets/images/waving-hand.png';
import { Button, Input, Text, Card, Icon } from '@/design-system/components/atoms';
import { LoginSuccessModal, ResendVerificationModal, AccountLockedModal } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { loginSchema, type LoginFormData } from '@/utils/validation/schemas';

import { authService } from '../services/authService';
import { loginAsync, clearError } from '../store/authSlice';

import type { LoginScreenNavigationProp } from '@/navigation/types';

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

function parseBackendValidationError(error: any): Record<string, string> | null {
  try {
    // Handle nested message structure from backend
    let errorData: unknown = error;
    if (
      error !== null &&
      error !== undefined &&
      typeof error === 'object' &&
      'response' in error &&
      error.response !== null &&
      error.response !== undefined &&
      typeof error.response === 'object' &&
      'data' in error.response
    ) {
      errorData = (error.response as { data: unknown }).data;
    }
    let validationErrors: BackendValidationError[] = [];

    // Try to extract validation errors from various backend response formats
    if (
      typeof errorData === 'object' &&
      errorData !== null &&
      'message' in errorData &&
      typeof (errorData as { message?: unknown }).message === 'object' &&
      (errorData as { message?: unknown }).message !== null &&
      typeof (errorData as { message?: { message?: unknown } }).message === 'object' &&
      Array.isArray(
        ((errorData as { message?: { message?: unknown } }).message as { message?: unknown })
          .message,
      )
    ) {
      validationErrors = (errorData as { message: { message: BackendValidationError[] } }).message
        .message;
    } else if (
      typeof errorData === 'object' &&
      errorData !== null &&
      'message' in errorData &&
      Array.isArray((errorData as any).message)
    ) {
      validationErrors = (errorData as { message: BackendValidationError[] }).message;
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

  // Show password toggle
  const [showPassword, setShowPassword] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userName, setUserName] = useState('');

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
          // Login successful! Show celebration modal
          setUserName(result.user.firstName || 'User');
          setShowSuccessModal(true);
          // Modal will auto-dismiss after 3 seconds, then navigate to MainStack
        }
      } catch (err: any) {
        console.error('Login error:', err);

        // Check if this is an account lockout error (403 with blockedUntil)
        if (err?.isAccountLocked && err?.blockedUntil) {
          console.log('[LoginScreen] Account locked error detected:', {
            blockedUntil: err.blockedUntil,
            message: err.message,
          });

          // Show account locked modal instead of inline error
          setBlockedUntil(err.blockedUntil);
          setShowLockedModal(true);

          // Clear the global error from Redux since we're showing the modal
          dispatch(clearError());
          return;
        }

        // Check if error has field-specific information from backend
        // Backend now returns: { field: 'email' | 'password', type: 'EMAIL_NOT_FOUND' | 'INVALID_PASSWORD' }
        if (err?.field && (err.field === 'email' || err.field === 'password')) {
          // Set inline error on the specific field
          const errorMessage = err.message || 'Invalid value';
          setError(err.field, {
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
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification email';
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
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: '#FFEBEE',
                    borderColor: theme.colors.error,
                  },
                ]}
              >
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
            <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
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
                <View style={styles.resendSection}>
                  <Text variant='body.small' color='secondary' style={styles.resendPrompt}>
                    Didn&apos;t receive the email?
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      void handleResendVerificationEmail();
                    }}
                    disabled={resendingEmail}
                    activeOpacity={0.7}
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
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Success Message for Resent Email */}
          {resendSuccess && (
            <View
              style={[styles.successBanner, { backgroundColor: theme.colors.primaryContainer }]}
            >
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
            <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
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
                label='Password'
                placeholder='Enter your password'
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='password'
                leftIcon={<Icon name='lock-closed-outline' family='Ionicons' size='md' />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Icon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      family='Ionicons'
                      size='md'
                    />
                  </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => onChange(!Boolean(value))}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: theme.colors.outline,
                        backgroundColor: value ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {value === true && (
                      <Text
                        style={{
                          color: theme.colors.onPrimary,
                          fontSize: 14,
                          lineHeight: 14,
                          includeFontPadding: false,
                          textAlignVertical: 'center',
                        }}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text variant='body.small' color='secondary'>
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNavigateToForgotPassword}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text variant='body.small' color='primary' weight='medium'>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />

          {/* Login Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
            textStyle={styles.loginButtonText}
            testID='login-submit-button'
          >
            Sign In
          </Button>

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
            <TouchableOpacity
              onPress={handleNavigateToRegister}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                variant='body.medium'
                color={theme.colors.primary}
                weight='semibold'
                style={[styles.signUpText, { textDecorationColor: theme.colors.primary }]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Resend Verification Link */}
          <View style={styles.verificationLinkContainer}>
            <Text variant='body.small' color={theme.colors.onSurfaceVariant}>
              Need to verify email?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => setShowResendModal(true)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                variant='body.small'
                color={theme.colors.primary}
                weight='semibold'
                style={[styles.verificationLinkText, { textDecorationColor: theme.colors.primary }]}
              >
                Resend Link
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Footer */}
        <Text variant='body.small' color='secondary' align='center' style={styles.footer}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>

      {/* Login Success Modal - Auto-dismisses after 3 seconds */}
      <LoginSuccessModal
        visible={showSuccessModal}
        userName={userName}
        onDismiss={() => setShowSuccessModal(false)}
      />

      {/* Resend Verification Modal */}
      <ResendVerificationModal
        visible={showResendModal}
        onDismiss={() => setShowResendModal(false)}
        onSuccess={handleResendSuccess}
        onSendVerification={handleResendFromModal}
      />

      {/* Account Locked Modal */}
      {blockedUntil && (
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
    shadowColor: '#000',
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
    borderColor: '#FFCDD2', // Light red border
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
    borderTopColor: 'rgba(0,0,0,0.1)',
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
    borderColor: '#C8E6C9', // Light green border
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
  loginButton: {
    marginBottom: 18,
  },
  loginButtonText: {
    fontSize: 16, // ← Adjust this value to increase/decrease text size
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
