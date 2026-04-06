/**
 * Register Screen
 * New user registration with full validation
 */

/* eslint-disable dot-notation */
// Note: Using bracket notation due to TypeScript's noPropertyAccessFromIndexSignature rule

import { yupResolver } from '@hookform/resolvers/yup';
import Icon from '@react-native-vector-icons/material-design-icons';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';

import { Button, Input, Text, Card } from '@/design-system/components/atoms';
import { PasswordStrengthIndicator } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { registerMobileSchema, type RegisterMobileFormData } from '@/utils/validation/schemas';

import { registerAsync, clearError } from '../store/authSlice';
import { UserRole } from '../types';

import type { RegisterRequest, RegisterResponse } from '../types';
import type { RegisterScreenNavigationProp } from '@/navigation/types';

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  // Memoized selector to prevent unnecessary re-renders
  // Only re-render when isLoading or error actually changes
  const authState = useAppSelector(
    (state) => ({ isLoading: state.auth.isLoading, error: state.auth.error }),
    (left, right) => left.isLoading === right.isLoading && left.error === right.error,
  );
  const { isLoading, error } = authState;

  // React Hook Form setup with Yup validation
  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
    setError,
  } = useForm<RegisterMobileFormData>({
    resolver: yupResolver(registerMobileSchema),
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Watch password for strength indicator
  const password = watch('password');
  const email = watch('email');
  const firstName = watch('firstName');
  const lastName = watch('lastName');

  // Show password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validity state (from PasswordStrengthIndicator)
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // Track if global error banner is dismissed
  const [isGlobalErrorDismissed, setIsGlobalErrorDismissed] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Clear Redux error on component unmount (but not for field-level errors)
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Only clear global errors, not field-level errors
      // Field-level errors are handled by local state
      if (
        typeof error === 'string' &&
        error.trim() !== '' &&
        !error.toLowerCase().includes('email') &&
        !error.toLowerCase().includes('phone') &&
        !error.toLowerCase().includes('password')
      ) {
        dispatch(clearError());
      }
    };
  }, [dispatch, error]);

  // Reset dismissed state when error changes
  useEffect(() => {
    setIsGlobalErrorDismissed(false);
  }, [error]);

  /**
   * Handle form submission (React Hook Form automatically validates)
   */
  const onSubmit = useCallback(
    async (formData: RegisterMobileFormData) => {
      // Additional check: password strength (from PasswordStrengthIndicator)
      if (!isPasswordValid) {
        setError('password', {
          type: 'manual',
          message:
            'Password does not meet security requirements. Please check the requirements below.',
        });
        return;
      }

      try {
        // Phone number removed - will be collected when placing first order
        // Role hardcoded to 'consumer' - merchants register via website
        const registerData: RegisterRequest = {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          role: UserRole.CONSUMER,
        };

        const dispatchResult = await dispatch(registerAsync(registerData));

        const result = dispatchResult.payload as RegisterResponse;

        if (dispatchResult.type.endsWith('/rejected')) {
          throw new Error(
            typeof result === 'object' && result !== null && 'message' in result
              ? (result as { message: string }).message
              : 'Registration failed',
          );
        }

        // ✅ IMPERATIVE NAVIGATION (Best Practice)
        // Screen is responsible for navigation after successful async operation
        // This is explicit, testable, and follows React Navigation recommendations
        //
        // Why imperative vs state-driven?
        // - Explicit: Easy to trace navigation flow in code
        // - Testable: Can mock navigation and assert it was called
        // - No side effects: Doesn't cause unwanted re-renders
        // - Standard pattern: Used by Uber, Stripe, Airbnb
        //
        // Redux state (flowState, pendingVerificationEmail) is still set for:
        // - Deep linking support
        // - Session restoration
        // - Cross-screen data sharing
        // Navigate to email verification with the registered email
        navigation.navigate('VerifyEmail', {
          email: result.user.email ?? registerData.email,
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Registration failed. Please try again.';

        // Only update state if component is still mounted
        if (!isMountedRef.current) {
          return;
        }

        // Parse backend validation errors (class-validator format)
        // Backend returns: { message: [{ property: 'email', constraints: { isEmail: '...' } }], ... }
        const fieldErrors: Record<string, string> = {};

        try {
          // Extract the error payload from the error message
          if (typeof err === 'object' && err !== null && 'message' in err) {
            const errObj = err as { message?: unknown };

            // Check if message is an array of validation errors
            if (Array.isArray(errObj.message)) {
              errObj.message.forEach((validationError: unknown) => {
                if (
                  typeof validationError === 'object' &&
                  validationError !== null &&
                  'property' in validationError &&
                  'constraints' in validationError
                ) {
                  const error = validationError as {
                    property: string;
                    constraints: Record<string, string>;
                  };
                  const field = error.property;
                  const constraintKeys = Object.keys(error.constraints);
                  if (constraintKeys.length > 0) {
                    // Take the first constraint message
                    const firstKey = constraintKeys[0]!;
                    const message = error.constraints[firstKey];
                    if (message !== undefined) {
                      fieldErrors[field] = message;
                    }
                  }
                }
              });
            }
          }
        } catch {
          // Ignore parse errors and fall back to generic handling below.
        }

        // If we extracted field-specific errors from backend, use them
        if (Object.keys(fieldErrors).length > 0) {
          // Set each field error using React Hook Form's setError
          Object.entries(fieldErrors).forEach(([field, message]) => {
            setError(field as keyof RegisterMobileFormData, {
              type: 'manual',
              message,
            });
          });
        } else {
          // Fallback to legacy error message parsing
          const lowerErrorMsg = errorMessage.toLowerCase();

          if (lowerErrorMsg.includes('email') && lowerErrorMsg.includes('already')) {
            setError('email', {
              type: 'manual',
              message: 'This email is already registered. Please use a different email.',
            });
          } else if (lowerErrorMsg.includes('password')) {
            setError('password', {
              type: 'manual',
              message: errorMessage,
            });
          }
        }
      }
    },
    [isPasswordValid, setError, dispatch, navigation, isMountedRef],
  );

  /**
   * Navigate to login screen
   * Uses replace() instead of goBack() to handle both scenarios:
   * 1. User came from WelcomeScreen (via replace) - no screen to go back to
   * 2. User came from LoginScreen (via navigate) - Login already in stack
   * replace() works correctly in both cases by ensuring Login is the current screen
   */
  const handleNavigateToLogin = useCallback(() => {
    navigation.replace('Login');
  }, [navigation]);

  /**
   * Render label with required asterisk
   */
  const renderRequiredLabel = (label: string) => (
    <>
      {label} <Text style={{ color: theme.colors.error }}>*</Text>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        contentInsetAdjustmentBehavior="automatic"
        bounces
        scrollEnabled
        nestedScrollEnabled
      >
        <Card style={styles.formCard}>
          <Text variant="headline.large" weight="semibold" style={styles.formTitle}>
            Create your account
          </Text>

          {/* Global error message from Redux - dismissable banner */}
          {error !== undefined &&
            error !== '' &&
            error.trim() !== '' &&
            !isGlobalErrorDismissed &&
            // Only show in banner if NOT already shown as field error
            !(error.toLowerCase().includes('email') && error.toLowerCase().includes('already')) &&
            !error.toLowerCase().includes('phone') &&
            !error.toLowerCase().includes('password') && (
              <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
                <Icon
                  name="alert-circle"
                  size={20}
                  color={theme.colors.onErrorContainer}
                  style={styles.errorIcon}
                />
                <Text
                  variant="body.small"
                  style={[styles.errorBannerText, { color: theme.colors.onErrorContainer }]}
                >
                  {error}
                </Text>
                <Pressable
                  onPress={() => {
                    setIsGlobalErrorDismissed(true);
                    dispatch(clearError());
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={20} color={theme.colors.onErrorContainer} />
                </Pressable>
              </View>
            )}

          {/* Name Fields Row */}
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={renderRequiredLabel('First name')}
                    placeholder="John"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoCorrect={false}
                    hasError={!!formErrors.firstName}
                    errorText={formErrors.firstName?.message}
                    editable={!isLoading}
                    testID="register-firstName-input"
                  />
                )}
              />
            </View>
            <View style={styles.nameField}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={renderRequiredLabel('Last name')}
                    placeholder="Doe"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoCorrect={false}
                    hasError={!!formErrors.lastName}
                    errorText={formErrors.lastName?.message}
                    editable={!isLoading}
                    testID="register-lastName-input"
                  />
                )}
              />
            </View>
          </View>

          {/* Email Input */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={renderRequiredLabel('Email address')}
                placeholder="john.doe@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                hasError={!!formErrors.email}
                errorText={formErrors.email?.message}
                editable={!isLoading}
                testID="register-email-input"
                style={styles.input}
              />
            )}
          />

          {/* Phone verification deferred to order placement */}

          {/* Password Input */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={renderRequiredLabel('Password')}
                placeholder="Create a strong password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                leftIcon="lock-closed-outline"
                leftIconFamily="Ionicons"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily="Ionicons"
                onRightIconPress={() => setShowPassword(!showPassword)}
                hasError={!!formErrors.password}
                errorText={formErrors.password?.message}
                editable={!isLoading}
                testID="register-password-input"
                style={styles.input}
              />
            )}
          />

          {/* Password Strength Indicator - Compact dropdown mode */}
          <PasswordStrengthIndicator
            password={password}
            context={{
              email,
              firstName,
              lastName,
            }}
            onValidityChange={setIsPasswordValid}
            dropdownMode
            autoHideWhenValid
            showRules
            showProgressBar
            enableHaptic
            enableAnimations
            testID="register-password-strength"
          />

          {/* Confirm Password Input */}
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={renderRequiredLabel('Confirm password')}
                placeholder="Re-enter your password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                leftIcon="lock-closed-outline"
                leftIconFamily="Ionicons"
                rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily="Ionicons"
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hasError={!!formErrors.confirmPassword}
                errorText={formErrors.confirmPassword?.message}
                editable={!isLoading}
                testID="register-confirmPassword-input"
                style={styles.input}
              />
            )}
          />

          {/* Terms and Privacy Policy - Automatic Acceptance */}
          <View style={styles.termsContainer}>
            <Text variant="body.small" color="secondary" style={styles.termsText}>
              By registering, you agree to the{' '}
              <Text variant="body.small" weight="bold" style={{ color: theme.colors.primary }}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text variant="body.small" weight="bold" style={{ color: theme.colors.primary }}>
                Privacy Policy
              </Text>
            </Text>
          </View>

          {/* Register Button */}
          <Button
            variant="primary"
            size="lg"
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
            loading={isLoading}
            disabled={isLoading}
            style={styles.registerButton}
            testID="register-submit-button"
          >
            Sign Up
          </Button>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text variant="body.medium" color={theme.colors.onSurfaceVariant}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={handleNavigateToLogin} disabled={isLoading}>
              <Text
                variant="body.medium"
                color={theme.colors.primary}
                weight="semibold"
                style={[styles.signInText, { textDecorationColor: theme.colors.primary }]}
              >
                Sign In
              </Text>
            </Pressable>
          </View>
        </Card>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80, // Extra bottom padding ensures all content is scrollable (especially on Android)
  },
  formCard: {
    padding: 24,
  },
  formTitle: {
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorBannerText: {
    flex: 1,
    lineHeight: 20,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  nameField: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
  },
  termsContainer: {
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  termsText: {
    lineHeight: 20,
    textAlign: 'center',
  },
  registerButton: {
    marginBottom: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    textDecorationLine: 'underline',
    // textDecorationColor is set inline using theme.colors.primary for dynamic theming
  },
});
