/**
 * LoginForm Organism
 * Production-ready login form with validation, security, and accessibility
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { parse as parseDomain } from 'tldts';

import { useTheme } from '../../../providers';
import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';
import { FormField } from '../../molecules/FormField';
import { showInfoAlert } from '@/utils/alert';

import type { LoginFormProps, LoginFormData } from './LoginForm.types';

// Social login icons placeholders
const GoogleIcon = () => <View style={iconStyles.google} />;
const AppleIcon = () => <View style={iconStyles.apple} />;
const FacebookIcon = () => <View style={iconStyles.facebook} />;
const CheckIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={[iconStyles.check, { backgroundColor: color }]} />
);

const iconStyles = StyleSheet.create({
  google: { width: 20, height: 20, backgroundColor: '#4285F4', borderRadius: 4 },
  apple: { width: 20, height: 20, backgroundColor: '#000', borderRadius: 4 },
  facebook: { width: 20, height: 20, backgroundColor: '#1877F2', borderRadius: 4 },
  check: { width: 16, height: 16, borderRadius: 3 },
});

export const LoginForm = React.memo<LoginFormProps>(function LoginForm({
  initialValues = {},
  loading = false,
  disabled = false,
  onSubmit,
  onForgotPassword,
  onSignUp,
  onGoogleLogin,
  onAppleLogin,
  onFacebookLogin,
  errors = {},
  errorMessage,
  successMessage,
  showSocialLogin = true,
  showForgotPassword = true,
  showSignUp = true,
  showRememberMe = false,
  rememberMe = false,
  onRememberMeChange,
  title = 'Welcome Back',
  subtitle = 'Sign in to your account',
  submitButtonText = 'Sign In',
  emailPlaceholder = 'Enter your email',
  passwordPlaceholder = 'Enter your password',
  validateOnChange = true,
  validators = {},
  style,
  formStyle,
  headerStyle,
  footerStyle,
  testID = 'login-form',
  accessibilityLabel = 'Login form',
}) {
  const theme = useTheme();
  const [formData, setFormData] = useState<LoginFormData>({
    email: initialValues.email || '',
    password: initialValues.password || '',
  });
  const [validationErrors, setValidationErrors] = useState<Partial<LoginFormData>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof LoginFormData, boolean>>>({});

  // Default validators with security best practices
  // Email validation uses Public Suffix List (PSL) to verify real ICANN TLDs
  const defaultValidators = useMemo(
    () => ({
      email: (value: string): string | null => {
        if (!value.trim()) return 'Email is required';

        // Basic format check
        const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!basicEmailRegex.test(value.trim())) {
          return 'Please enter a valid email address';
        }

        // Extract domain and validate TLD using Public Suffix List
        const domain = value.trim().split('@')[1];
        if (!domain) return 'Please enter a valid email address';

        const parsed = parseDomain(domain);
        // Reject invalid TLDs like .or, .rt, .c
        if (parsed.isIcann !== true || parsed.publicSuffix === null) {
          return 'Please enter a valid email address';
        }

        // Security: Check for common injection patterns
        if (value.includes('<') || value.includes('>') || value.includes('"')) {
          return 'Invalid characters in email';
        }

        return null;
      },
      password: (value: string): string | null => {
        if (!value) return 'Password is required';

        if (value.length < 8) return 'Password must be at least 8 characters';

        // Security: Basic password strength check
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
          return 'Password must contain uppercase, lowercase, and numbers';
        }

        return null;
      },
    }),
    [],
  );

  // Combine default and custom validators
  const combinedValidators = useMemo(
    () => ({
      ...defaultValidators,
      ...validators,
    }),
    [defaultValidators, validators],
  );

  // Validate single field
  const validateField = useCallback(
    (field: keyof LoginFormData, value: string): string | null => {
      const validator = combinedValidators[field];
      return validator ? validator(value) : null;
    },
    [combinedValidators],
  );

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    Object.keys(formData).forEach(key => {
      const field = key as keyof LoginFormData;
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Handle field change
  const handleFieldChange = useCallback(
    (field: keyof LoginFormData) => (value: string) => {
      // Security: Sanitize input
      const sanitizedValue = value.replace(/[<>'"]/g, ''); // Remove potential XSS chars

      setFormData(prev => ({ ...prev, [field]: sanitizedValue }));

      // Validate on change if enabled
      if (validateOnChange && touched[field]) {
        const error = validateField(field, sanitizedValue);
        setValidationErrors(prev => ({ ...prev, [field]: error }));
      }
    },
    [validateOnChange, touched, validateField],
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (field: keyof LoginFormData) => () => {
      setTouched(prev => ({ ...prev, [field]: true }));

      const error = validateField(field, formData[field]);
      setValidationErrors(prev => ({ ...prev, [field]: error }));
    },
    [formData, validateField],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true,
    });

    // Validate form
    if (!validateForm()) {
      // Don't show alert - inline errors are sufficient and more professional
      // showErrorAlert('Validation Error', 'Please correct the errors in the form');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Login submission error:', error);
    }
  }, [formData, validateForm, onSubmit]);

  // Handle social login
  const handleSocialLogin = useCallback(
    (provider: string, handler?: () => void) => () => {
      if (handler) {
        handler();
      } else {
        showInfoAlert('Social Login', `${provider} login not implemented`);
      }
    },
    [],
  );

  // Render header
  const renderHeader = () => (
    <View style={[{ marginBottom: theme.spacing.base.xl }, headerStyle]}>
      <Text
        variant='headline.large'
        weight='bold'
        align='center'
        style={{ marginBottom: theme.spacing.base.sm }}
        testID={`${testID}-title`}
      >
        {title}
      </Text>

      {subtitle && (
        <Text
          variant='body.medium'
          style={formStyles.subtitleText}
          align='center'
          testID={`${testID}-subtitle`}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  // Render error/success messages
  const renderMessages = () => (
    <View style={{ marginBottom: theme.spacing.base.md }}>
      {errorMessage && (
        <View
          style={{
            backgroundColor: '#FFEBEE',
            borderColor: '#D32F2F',
            borderWidth: 1,
            borderRadius: theme.spacing.radius.md,
            padding: theme.spacing.base.md,
            marginBottom: theme.spacing.base.sm,
          }}
        >
          <Text
            variant='body.small'
            style={{ color: '#D32F2F' }}
            testID={`${testID}-error-message`}
          >
            {errorMessage}
          </Text>
        </View>
      )}

      {successMessage && (
        <View
          style={{
            backgroundColor: '#E8F5E8',
            borderColor: '#2E7D32',
            borderWidth: 1,
            borderRadius: theme.spacing.radius.md,
            padding: theme.spacing.base.md,
            marginBottom: theme.spacing.base.sm,
          }}
        >
          <Text
            variant='body.small'
            style={{ color: '#2E7D32' }}
            testID={`${testID}-success-message`}
          >
            {successMessage}
          </Text>
        </View>
      )}
    </View>
  );

  // Render form fields
  const renderFormFields = () => (
    <View style={{ gap: theme.spacing.base.md }}>
      <FormField
        label='Email Address'
        value={formData.email}
        onChangeText={handleFieldChange('email')}
        onBlur={handleFieldBlur('email')}
        placeholder={emailPlaceholder}
        type='email'
        required
        disabled={disabled || loading}
        errorText={(touched.email ? validationErrors.email || errors.email : undefined) || ''}
        testID={`${testID}-email`}
      />

      <FormField
        label='Password'
        value={formData.password}
        onChangeText={handleFieldChange('password')}
        onBlur={handleFieldBlur('password')}
        placeholder={passwordPlaceholder}
        type='password'
        required
        disabled={disabled || loading}
        errorText={
          (touched.password ? validationErrors.password || errors.password : undefined) || ''
        }
        testID={`${testID}-password`}
      />

      {showRememberMe && (
        <Pressable
          onPress={() => onRememberMeChange?.(!rememberMe)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: theme.spacing.base.sm,
          }}
          testID={`${testID}-remember-me`}
          accessible
          accessibilityRole='checkbox'
          accessibilityState={{ checked: rememberMe }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderWidth: 2,
              borderColor: theme.colors.primary,
              borderRadius: theme.spacing.radius.sm,
              marginRight: theme.spacing.base.sm,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: rememberMe ? theme.colors.primary : 'transparent',
            }}
          >
            {rememberMe && <CheckIcon color={theme.colors.onPrimary} />}
          </View>
          <Text variant='body.medium'>Remember me</Text>
        </Pressable>
      )}
    </View>
  );

  // Render submit button
  const renderSubmitButton = () => (
    <Button
      variant='primary'
      size='lg'
      fullWidth
      onPress={handleSubmit}
      loading={loading}
      disabled={disabled}
      style={{ marginTop: theme.spacing.base.lg }}
      testID={`${testID}-submit`}
    >
      {submitButtonText}
    </Button>
  );

  // Render social login
  const renderSocialLogin = () => {
    if (!showSocialLogin) return null;

    const socialProviders = [
      { name: 'Google', icon: GoogleIcon, handler: onGoogleLogin },
      { name: 'Apple', icon: AppleIcon, handler: onAppleLogin },
      { name: 'Facebook', icon: FacebookIcon, handler: onFacebookLogin },
    ].filter(provider => provider.handler);

    if (socialProviders.length === 0) return null;

    return (
      <View style={{ marginTop: theme.spacing.base.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: theme.spacing.base.md,
          }}
        >
          <View style={formStyles.dividerLine} />
          <Text
            variant='body.small'
            style={[formStyles.subtitleText, { marginHorizontal: theme.spacing.base.md }]}
          >
            Or continue with
          </Text>
          <View style={formStyles.dividerLine} />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.base.md }}>
          {socialProviders.map(provider => (
            <Button
              key={provider.name}
              variant='outline'
              size='md'
              leftIcon={<provider.icon />}
              onPress={handleSocialLogin(provider.name, provider.handler)}
              disabled={disabled || loading}
              style={{ flex: 1 }}
              testID={`${testID}-${provider.name.toLowerCase()}`}
            >
              {provider.name}
            </Button>
          ))}
        </View>
      </View>
    );
  };

  // Render footer links
  const renderFooter = () => (
    <View style={[{ marginTop: theme.spacing.base.lg, alignItems: 'center' }, footerStyle]}>
      {showForgotPassword && (
        <Pressable
          onPress={onForgotPassword}
          style={{ marginBottom: theme.spacing.base.md }}
          testID={`${testID}-forgot-password`}
          accessible
          accessibilityRole='button'
        >
          <Text variant='body.medium' style={{ color: theme.colors.primary }}>
            Forgot your password?
          </Text>
        </Pressable>
      )}

      {showSignUp && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant='body.medium' style={formStyles.subtitleText}>
            Don't have an account?{' '}
          </Text>
          <Pressable
            onPress={onSignUp}
            testID={`${testID}-sign-up`}
            accessible
            accessibilityRole='button'
          >
            <Text variant='body.medium' weight='medium' style={{ color: theme.colors.primary }}>
              Sign up
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[
        {
          padding: theme.spacing.base.lg,
        },
        style,
      ]}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {renderHeader()}
      {renderMessages()}

      <View style={formStyle}>
        {renderFormFields()}
        {renderSubmitButton()}
        {renderSocialLogin()}
      </View>

      {renderFooter()}
    </View>
  );
});

const formStyles = StyleSheet.create({
  subtitleText: {
    color: '#424242',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
});

export default LoginForm;
