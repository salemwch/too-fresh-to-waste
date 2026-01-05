/**
 * Register Screen
 * New user registration with full validation
 */

/* eslint-disable dot-notation */
// Note: Using bracket notation due to TypeScript's noPropertyAccessFromIndexSignature rule

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { parse as parseDomain } from 'tldts';

import { Button, Input, Text, Card } from '@/design-system/components/atoms';
import { PasswordStrengthIndicator } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';

import { registerAsync, clearError } from '../store/authSlice';
import { UserRole } from '../types';

import type { RegisterFormData, RegisterRequest, RegisterResponse } from '../types';
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
    state => ({ isLoading: state.auth.isLoading, error: state.auth.error }),
    (left, right) => left.isLoading === right.isLoading && left.error === right.error,
  );
  const { isLoading, error } = authState;

  // Component lifecycle logging
  console.log('🔵 RegisterScreen RENDERED');

  // Debug: Log error value to see what's causing the red box
  if (error !== undefined && error !== '') {
    console.log('RegisterScreen Redux error value:', JSON.stringify(error));
  }

  // Form state (phoneNumber removed - deferred to order placement, role hardcoded to consumer)
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  // Field-level errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validity state (from PasswordStrengthIndicator)
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // Track if confirm password field is focused
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  // Track if user has blurred the confirm password field (to show validation)
  const [hasBlurredConfirmPassword, setHasBlurredConfirmPassword] = useState(false);

  // Track if user has blurred the email field (to show validation on blur)
  const [hasBlurredEmail, setHasBlurredEmail] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);

  // Track if global error banner is dismissed
  const [isGlobalErrorDismissed, setIsGlobalErrorDismissed] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Clear Redux error on component unmount (but not for field-level errors)
  useEffect(() => {
    console.log('🟢 RegisterScreen MOUNTED');
    isMountedRef.current = true;

    return () => {
      console.log('🔴 RegisterScreen UNMOUNTING');
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

  // Real-time password match check
  const passwordsMatch =
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword;

  // Only show mismatch error after user has blurred the field AND passwords don't match
  const showPasswordMismatch =
    hasBlurredConfirmPassword &&
    !isConfirmPasswordFocused &&
    formData.confirmPassword.length > 0 &&
    !passwordsMatch;

  /**
   * Validate email format using Public Suffix List (PSL)
   * Two-layer validation:
   * 1. Client-side: Check format + verify TLD is ICANN-registered
   * 2. Backend: Final verification (class-validator @IsEmail)
   *
   * This rejects:
   * - Invalid TLDs: .or, .rt, .c, .xyz123
   * And accepts:
   * - Valid TLDs: .com, .org, .co, .co.uk, .io, .dev
   */
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return false;

    // Basic format check: must contain @ and have characters before/after
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email.trim())) return false;

    // Extract domain part (everything after @)
    const domain = email.trim().split('@')[1];
    if (!domain) return false;

    // Parse domain using tldts (Public Suffix List)
    const parsed = parseDomain(domain);

    // Check if it's a valid ICANN-registered TLD
    // This will reject .or, .rt, .c but accept .com, .org, .co, .co.uk
    return parsed.isIcann === true && parsed.publicSuffix !== null;
  };

  // Show email validation error after user has blurred the field AND email is invalid
  const isEmailValid = validateEmail(formData.email);
  const showEmailError =
    hasBlurredEmail && !isEmailFocused && formData.email.length > 0 && !isEmailValid;

  /**
   * Validate form fields
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors['firstName'] = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors['firstName'] = 'First name must be at least 2 characters';
    } else if (formData.firstName.trim().length > 50) {
      newErrors['firstName'] = 'First name cannot exceed 50 characters';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors['lastName'] = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors['lastName'] = 'Last name must be at least 2 characters';
    } else if (formData.lastName.trim().length > 50) {
      newErrors['lastName'] = 'Last name cannot exceed 50 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors['email'] = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors['email'] = 'Please enter a valid email address';
    }

    // Phone number validation removed - deferred to order placement

    // Password validation - use PasswordStrengthIndicator result
    if (!formData.password) {
      newErrors['password'] = 'Password is required';
    } else if (!isPasswordValid) {
      newErrors['password'] =
        'Password does not meet security requirements. Please check the requirements below.';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors['confirmPassword'] = 'Please confirm your password';
    } else if (!passwordsMatch) {
      newErrors['confirmPassword'] = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isPasswordValid]);

  /**
   * Handle form submission
   */
  const handleRegister = useCallback(async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      console.log('RegisterScreen: Form validation failed');
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

      console.log('===== REGISTRATION FLOW START =====');
      console.log('RegisterScreen: Starting registration for:', registerData.email);
      console.log('RegisterScreen: Full registration data (password hidden):', {
        ...registerData,
        password: '[HIDDEN]',
      });

      const dispatchResult = await dispatch(registerAsync(registerData));
      console.log('RegisterScreen: Dispatch result:', dispatchResult);
      console.log('RegisterScreen: Dispatch result type:', dispatchResult.type);
      console.log('RegisterScreen: Dispatch result payload:', dispatchResult.payload);

      const result = dispatchResult.payload as RegisterResponse;
      console.log('RegisterScreen: Extracted payload:', result);

      if (dispatchResult.type.endsWith('/rejected')) {
        console.error('RegisterScreen: Registration was REJECTED by Redux');
        throw new Error(
          typeof result === 'object' && result !== null && 'message' in result
            ? (result as { message: string }).message
            : 'Registration failed',
        );
      }

      console.log('RegisterScreen: Registration successful! Response:', result);

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
      console.log('===== REGISTRATION FLOW SUCCESS =====');
      console.log('RegisterScreen: Navigating to VerifyEmail...');

      // Navigate to email verification with the registered email
      navigation.navigate('VerifyEmail', {
        email: result.user.email ?? registerData.email,
      });

      console.log('===== REGISTRATION COMPLETE =====');
    } catch (err: unknown) {
      console.log('==========================================');
      console.log('===== REGISTRATION FLOW ERROR =====');
      console.log('==========================================');
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';

      console.log('RegisterScreen: Registration CAUGHT ERROR:', errorMessage);
      console.error('RegisterScreen: Full error object:', err);
      console.error('RegisterScreen: Error type:', typeof err);
      console.error('RegisterScreen: Error constructor:', err?.constructor?.name);
      console.log('RegisterScreen: About to set local errors state...');

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        console.log('RegisterScreen: Component unmounted, skipping error state update');
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

            console.log('RegisterScreen: Parsed backend validation errors:', fieldErrors);
          }
        }
      } catch (parseError) {
        console.error('RegisterScreen: Error parsing validation errors:', parseError);
      }

      // If we extracted field-specific errors from backend, use them
      if (Object.keys(fieldErrors).length > 0) {
        console.log('RegisterScreen: Setting field errors from backend:', fieldErrors);
        setErrors(fieldErrors);
      } else {
        // Fallback to legacy error message parsing
        const lowerErrorMsg = errorMessage.toLowerCase();

        if (lowerErrorMsg.includes('email') && lowerErrorMsg.includes('already')) {
          console.log('RegisterScreen: Showing email already exists error');
          setErrors({
            email: 'This email is already registered. Please use a different email.',
          });
        } else if (lowerErrorMsg.includes('phone')) {
          console.log('RegisterScreen: Showing phone number error');
          setErrors({
            phoneNumber: errorMessage,
          });
        } else if (lowerErrorMsg.includes('password')) {
          console.log('RegisterScreen: Showing password error');
          setErrors({
            password: errorMessage,
          });
        } else {
          console.log(
            'RegisterScreen: Error not matching any specific case, will show in banner',
          );
        }
      }

      // For other errors, Redux state.error will show in global banner
      // No Alert.alert - professional inline error display only
      console.log('RegisterScreen: Component should stay mounted with error visible');
      console.log('===== REGISTRATION FLOW ERROR END =====');
      console.log('==========================================');
    }
  }, [formData, validateForm, dispatch, navigation, isMountedRef]);

  /**
   * Handle field change
   */
  const handleFieldChange = useCallback(
    <K extends keyof RegisterFormData>(field: K, value: RegisterFormData[K]) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Clear error for this field when user types
      if (errors[field] !== undefined && errors[field] !== '') {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors],
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

  /**
   * Render confirm password label with dynamic color
   */
  const renderConfirmPasswordLabel = () => {
    const labelColor = isConfirmPasswordFocused
      ? theme.colors.primary // Green when focused
      : showPasswordMismatch
        ? theme.colors.error // Red when blurred and mismatch
        : theme.colors.onSurface; // Default black

    return (
      <>
        <Text style={{ color: labelColor }}>Confirm password</Text>{' '}
        <Text style={{ color: theme.colors.error }}>*</Text>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator
        contentInsetAdjustmentBehavior='automatic'
        bounces
        scrollEnabled
        nestedScrollEnabled
      >
        <Card style={styles.formCard}>
          <Text variant='headline.large' weight='semibold' style={styles.formTitle}>
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
                  name='alert-circle'
                  size={20}
                  color={theme.colors.onErrorContainer}
                  style={styles.errorIcon}
                />
                <Text
                  variant='body.small'
                  style={[styles.errorBannerText, { color: theme.colors.onErrorContainer }]}
                >
                  {error}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsGlobalErrorDismissed(true);
                    dispatch(clearError());
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Icon name='close' size={20} color={theme.colors.onErrorContainer} />
                </TouchableOpacity>
              </View>
            )}

          {/* Name Fields Row */}
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Input
                label={renderRequiredLabel('First name')}
                placeholder='John'
                value={formData.firstName}
                onChangeText={value => handleFieldChange('firstName', value)}
                autoCapitalize='words'
                autoCorrect={false}
                hasError={errors['firstName'] !== undefined && errors['firstName'] !== ''}
                errorText={errors['firstName']}
                editable={!isLoading}
                testID='register-firstName-input'
              />
            </View>
            <View style={styles.nameField}>
              <Input
                label={renderRequiredLabel('Last name')}
                placeholder='Doe'
                value={formData.lastName}
                onChangeText={value => handleFieldChange('lastName', value)}
                autoCapitalize='words'
                autoCorrect={false}
                hasError={errors['lastName'] !== undefined && errors['lastName'] !== ''}
                errorText={errors['lastName']}
                editable={!isLoading}
                testID='register-lastName-input'
              />
            </View>
          </View>

          {/* Email Input */}
          <Input
            label={renderRequiredLabel('Email address')}
            placeholder='john.doe@example.com'
            value={formData.email}
            onChangeText={value => handleFieldChange('email', value)}
            onFocus={() => setIsEmailFocused(true)}
            onBlur={() => {
              setIsEmailFocused(false);
              setHasBlurredEmail(true);
            }}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='email'
            hasError={(errors['email'] !== undefined && errors['email'] !== '') || showEmailError}
            errorText={
              errors['email'] !== undefined && errors['email'] !== ''
                ? errors['email']
                : showEmailError
                  ? 'Please enter a valid email address'
                  : undefined
            }
            editable={!isLoading}
            testID='register-email-input'
            style={styles.input}
          />

          {/* Phone verification deferred to order placement */}

          {/* Password Input */}
          <Input
            label={renderRequiredLabel('Password')}
            placeholder='Create a strong password'
            value={formData.password}
            onChangeText={value => handleFieldChange('password', value)}
            secureTextEntry={!showPassword}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='password-new'
            leftIcon='lock-closed-outline'
            leftIconFamily='Ionicons'
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            rightIconFamily='Ionicons'
            onRightIconPress={() => setShowPassword(!showPassword)}
            hasError={errors['password'] !== undefined && errors['password'] !== ''}
            errorText={errors['password']}
            editable={!isLoading}
            testID='register-password-input'
            style={styles.input}
          />

          {/* Password Strength Indicator - Compact dropdown mode */}
          <PasswordStrengthIndicator
            password={formData.password}
            context={{
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
            }}
            onValidityChange={setIsPasswordValid}
            dropdownMode
            autoHideWhenValid
            showRules
            showProgressBar
            enableHaptic
            enableAnimations
            testID='register-password-strength'
          />

          {/* Confirm Password Input */}
          <Input
            label={renderConfirmPasswordLabel()}
            placeholder='Re-enter your password'
            value={formData.confirmPassword}
            onChangeText={value => handleFieldChange('confirmPassword', value)}
            onFocus={() => setIsConfirmPasswordFocused(true)}
            onBlur={() => {
              setIsConfirmPasswordFocused(false);
              setHasBlurredConfirmPassword(true);
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='password-new'
            leftIcon='lock-closed-outline'
            leftIconFamily='Ionicons'
            rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
            rightIconFamily='Ionicons'
            onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hasError={showPasswordMismatch}
            editable={!isLoading}
            testID='register-confirmPassword-input'
            style={styles.input}
            inputContainerStyle={
              showPasswordMismatch
                ? {
                    borderColor: theme.colors.error,
                  }
                : undefined
            }
          />

          {/* Password Match Indicator */}
          {showPasswordMismatch && (
            <View style={styles.passwordMatchIndicator}>
              <Text style={[styles.passwordMismatchText, { color: theme.colors.error }]}>
                Passwords should be the same
              </Text>
            </View>
          )}

          {/* Terms and Privacy Policy - Automatic Acceptance */}
          <View style={styles.termsContainer}>
            <Text variant='body.small' color='secondary' style={styles.termsText}>
              By registering, you agree to the{' '}
              <Text variant='body.small' weight='bold' style={{ color: theme.colors.primary }}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text variant='body.small' weight='bold' style={{ color: theme.colors.primary }}>
                Privacy Policy
              </Text>
            </Text>
          </View>

          {/* Register Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={() => {
              void handleRegister();
            }}
            loading={isLoading}
            disabled={isLoading}
            style={styles.registerButton}
            testID='register-submit-button'
          >
            Sign Up
          </Button>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text variant='body.medium' color={theme.colors.onSurfaceVariant}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={handleNavigateToLogin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                variant='body.medium'
                color={theme.colors.primary}
                weight='semibold'
                style={[styles.signInText, { textDecorationColor: theme.colors.primary }]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
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
  passwordMatchIndicator: {
    marginTop: -12,
    marginBottom: 16,
    paddingLeft: 4,
  },
  passwordMismatchText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
