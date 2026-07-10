/**
 * Reset Password Screen
 * Enterprise-grade password reset confirmation with:
 * - Deep link integration (email + token from URL)
 * - Real-time password strength validation
 * - Password confirmation matching
 * - Comprehensive error handling
 * - Secure input handling
 * - Accessibility support
 */

import { yupResolver } from '@hookform/resolvers/yup';
import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';

import { Button, Input, Text, Card, Icon } from '@/design-system/components/atoms';
import { PasswordStrengthIndicator } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { ErrorType, getErrorMessage, isAppError } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/utils/validation/schemas';

import { authService } from '../services/authService';

import type { ResetPasswordScreenProps } from '@/navigation/types';

/**
 * ResetPasswordScreen Component
 * Handles password reset confirmation after user clicks email link
 */
export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  // Extract params from deep link
  const { email, token } = route.params;

  // React Hook Form setup with Yup validation
  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
    setError: setFormError,
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues: {
      password: '',
    },
  });

  // Watch password for strength indicator
  const password = watch('password');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordReuseError, setPasswordReuseError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Log screen mount for analytics
   */
  useEffect(() => {
    Logger.info('ResetPasswordScreen mounted', {
      email: email ? `${email.substring(0, 3)}***` : 'not provided',
      hasToken: !!token,
    });

    if (!token) {
      Logger.error('ResetPasswordScreen: Missing token param');
      setError(t('resetPassword.invalidLink'));
    }

    return () => {
      Logger.debug('ResetPasswordScreen unmounted');
    };
  }, [email, token]);

  /**
   * Handle password reset submission (React Hook Form automatically validates)
   */
  const onSubmit = useCallback(
    async (formData: ResetPasswordFormData) => {
      // Clear previous errors
      setError(null);

      if (!token) {
        setError(t('resetPassword.requestNewReset'));
        Logger.error('ResetPassword: Missing token');
        return;
      }

      if (!isPasswordValid) {
        setFormError('password', {
          type: 'manual',
          message: t('register.passwordSecurityRequirements'),
        });
        Logger.warn('ResetPassword: Weak password attempt');
        return;
      }

      setIsLoading(true);
      Logger.info('Attempting password reset', {
        email: email ? `${email.substring(0, 3)}***` : 'not provided',
      });

      try {
        await authService.confirmPasswordReset({
          ...(email ? { email: email.trim().toLowerCase() } : {}),
          token: token.trim(),
          newPassword: formData.password,
        });

        Logger.info('Password reset successful');

        // Show success screen
        setIsSuccess(true);
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err, 'Failed to reset password. Please try again.');
        const errorType = isAppError(err) ? err.type : undefined;

        Logger.error('Password reset failed', {
          error: errorMessage,
          type: errorType ?? 'UNKNOWN',
        });

        // Handle specific error types
        if (
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('invalid token')
        ) {
          setError(t('resetPassword.expiredLink'));
        } else if (
          errorMessage.toLowerCase().includes('password') &&
          (errorMessage.toLowerCase().includes('last') ||
            errorMessage.toLowerCase().includes('used before') ||
            errorMessage.toLowerCase().includes('reuse'))
        ) {
          // Handle password reuse error - show under password field
          setPasswordReuseError(t('resetPassword.passwordReused'));
        } else if (errorType === ErrorType.NETWORK) {
          setError(t('resetPassword.networkError'));
        } else if (errorType === ErrorType.VALIDATION) {
          setError(
            errorMessage ||
              'Password does not meet security requirements. Please choose a stronger password.',
          );
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [email, token, isPasswordValid, setFormError],
  );

  /**
   * Navigate to forgot password screen for new reset link
   */
  const handleRequestNewLink = useCallback(() => {
    Keyboard.dismiss();
    Logger.info('User requested new password reset link');
    navigation.navigate('ForgotPassword');
  }, [navigation]);

  /**
   * Navigate back to login
   *
   * Wait for the keyboard to FULLY hide before mounting LoginScreen.
   * Without this, LoginScreen's KeyboardAvoidingView mounts mid-animation
   * and adjusts layout twice (keyboard partially visible → hidden), causing
   * the visible up/down bounce.
   *
   * Strategy:
   *  - Dismiss keyboard, then listen for keyboardDidHide (fires after animation)
   *  - 50ms fallback handles the case where keyboard was already hidden
   *    (keyboardDidHide never fires when keyboard is not shown)
   */
  const handleBackToLogin = useCallback(() => {
    Logger.info('User navigated back to login');

    const doReset = () => {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    Keyboard.dismiss();

    const sub = Keyboard.addListener('keyboardDidHide', () => {
      sub.remove();
      clearTimeout(fallback);
      doReset();
    });

    // Fallback: keyboard was already hidden → keyboardDidHide won't fire
    const fallback = setTimeout(() => {
      sub.remove();
      doReset();
    }, 50);
  }, [navigation]);

  /**
   * Navigate to login after successful password reset
   */
  const handleGoToLogin = useCallback(() => {
    Logger.info('User proceeding to login after password reset');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  /**
   * Render error banner if expired/invalid token
   */
  const showRequestNewLinkButton =
    (error?.toLowerCase().includes('expired') ?? false) ||
    (error?.toLowerCase().includes('invalid') ?? false);

  // Success state - password reset complete
  if (isSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.successCard}>
            {/* Success Icon */}
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.successIconCircle,
                  { backgroundColor: theme.colors.successContainer },
                ]}
              >
                <Icon
                  name='checkmark-circle'
                  family='Ionicons'
                  size={64}
                  color={theme.colors.success}
                />
              </View>
            </View>

            {/* Success Title */}
            <Text
              variant='headline'
              size='lg'
              weight='semibold'
              align='center'
              style={styles.successTitle}
            >
              {t('resetPassword.successTitle')}
            </Text>

            {/* Success Message */}
            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.successMessage}
            >
              {t('resetPassword.successMessage')}
            </Text>

            {/* Security Note */}
            <View style={[styles.securityNote, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Icon
                name='shield-checkmark'
                family='Ionicons'
                size={20}
                color={theme.colors.primary}
              />
              <Text variant='body' size='sm' color='secondary' style={styles.securityNoteText}>
                {t('resetPassword.sessionsLoggedOut')}
              </Text>
            </View>

            {/* Go to Login Button */}
            <Button
              variant='primary'
              size='lg'
              onPress={handleGoToLogin}
              style={styles.successButton}
              testID='go-to-login-button'
            >
              {t('resetPassword.goToLogin')}
            </Button>
          </Card>
        </ScrollView>
      </View>
    );
  }

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
        <Card style={styles.formCard}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name='key' family='Ionicons' size={48} color={theme.colors.primary} />
            </View>
          </View>

          {/* Title */}
          <Text variant='headline' size='lg' weight='semibold' align='center' style={styles.title}>
            {t('resetPassword.title')}
          </Text>

          {/* Subtitle */}
          <Text variant='body' size='md' color='secondary' align='center' style={styles.subtitle}>
            {t('resetPassword.description')}
          </Text>

          {/* Email Display — only shown when email is available (in-app navigation) */}
          {email ? (
            <View
              style={[
                styles.emailContainer,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
              ]}
            >
              <Icon
                name='mail-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <View style={styles.emailTextContainer}>
                <Text variant='body' size='xs' color='secondary'>
                  Resetting password for:
                </Text>
                <Text variant='body' size='sm' weight='semibold' style={styles.emailText}>
                  {email}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Message */}
          {error && (
            <View
              style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
              accessible
              accessibilityRole='alert'
              accessibilityLabel={`Error: ${error}`}
              accessibilityHint='Displays an error message'
            >
              <Icon
                name='alert-circle'
                family='Ionicons'
                size={20}
                color={theme.colors.onErrorContainer}
              />
              <Text
                variant='body'
                size='sm'
                style={[styles.errorBannerText, { color: theme.colors.onErrorContainer }]}
              >
                {error}
              </Text>
            </View>
          )}

          {/* Password Input */}
          <Controller
            control={control}
            name='password'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='New Password'
                placeholder='Enter your new password'
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setError(null);
                  setPasswordReuseError(null);
                }}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='password-new'
                textContentType='newPassword'
                leftIcon='lock-closed-outline'
                leftIconFamily='Ionicons'
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily='Ionicons'
                onRightIconPress={() => setShowPassword(!showPassword)}
                hasError={!!formErrors.password || !!passwordReuseError}
                errorText={formErrors.password?.message}
                editable={!isLoading}
                testID='reset-password-new-input'
                accessibilityLabel='New password input'
                accessibilityHint='Enter your new password. It must be at least 8 characters long.'
              />
            )}
          />

          {/* Password Strength Indicator - Compact dropdown mode */}
          <PasswordStrengthIndicator
            password={password}
            context={{
              ...(email ? { email } : {}),
            }}
            dropdownMode
            autoHideWhenValid
            showRules
            showProgressBar
            enableHaptic
            enableAnimations
            onValidityChange={setIsPasswordValid}
            testID='reset-password-strength'
          />

          {/* Password Reuse Error - shown under password field */}
          {passwordReuseError && (
            <View style={styles.fieldErrorIndicator} accessible accessibilityRole='alert'>
              <Icon name='close-circle' family='Ionicons' size={16} color={theme.colors.error} />
              <Text
                variant='body'
                size='sm'
                style={[styles.fieldErrorText, { color: theme.colors.error }]}
              >
                {passwordReuseError}
              </Text>
            </View>
          )}

          {/* Reset Password Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
            loading={isLoading}
            disabled={isLoading || !isPasswordValid}
            style={styles.submitButton}
            testID='reset-password-submit-button'
            accessibilityLabel='Reset password button'
            accessibilityHint='Tap to confirm and reset your password'
            accessibilityState={{ disabled: isLoading || !isPasswordValid, busy: isLoading }}
          >
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </Button>

          {/* Request New Link Button (shown on expired/invalid token) */}
          {showRequestNewLinkButton && (
            <Button
              variant='outline'
              size='md'
              onPress={handleRequestNewLink}
              style={styles.linkButton}
              testID='request-new-link-button'
              accessibilityLabel='Request new reset link'
              accessibilityHint='Tap to request a new password reset link via email'
            >
              Request New Reset Link
            </Button>
          )}

          {/* Back to Login */}
          <Button
            variant='ghost'
            size='md'
            onPress={handleBackToLogin}
            disabled={isLoading}
            style={styles.backButton}
            testID='back-to-login-button'
            accessibilityLabel='Back to login'
            accessibilityHint='Tap to return to the login screen'
          >
            Back to Login
          </Button>
        </Card>

        {/* Security Info */}
        <View style={styles.securityInfo} accessible accessibilityRole='text'>
          <Icon
            name='shield-checkmark-outline'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant='body' size='xs' color='secondary' style={styles.securityText}>
            Your password is encrypted with industry-standard Argon2 hashing and stored securely.
            For your security, all active sessions will be logged out after password reset.
          </Text>
        </View>
      </ScrollView>
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
  formCard: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 12,
  },
  subtitle: {
    marginBottom: 24,
    lineHeight: 22,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
  },
  emailTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  emailText: {
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    marginLeft: 8,
    flex: 1,
  },
  fieldErrorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  fieldErrorText: {
    marginLeft: 6,
  },
  submitButton: {
    marginTop: 24,
  },
  linkButton: {
    marginTop: 12,
  },
  backButton: {
    marginTop: 8,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  securityText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
  // Success screen styles
  successCard: {
    padding: 32,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginBottom: 16,
  },
  successMessage: {
    marginBottom: 24,
    lineHeight: 22,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  securityNoteText: {
    flex: 1,
    marginLeft: 12,
    lineHeight: 20,
  },
  successButton: {
    marginTop: 8,
  },
});
