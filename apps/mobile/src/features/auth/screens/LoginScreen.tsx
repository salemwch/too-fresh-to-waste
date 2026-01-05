/**
 * Login Screen
 * User authentication with email/password, MFA support, and remember me
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { parse as parseDomain } from 'tldts';

import LeafLogo from '@/assets/images/leaf.png';
import WavingHand from '@/assets/images/waving-hand.png';
import { Button, Input, Text, Card, Icon } from '@/design-system/components/atoms';
import { LoginSuccessModal } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';

import { loginAsync, clearError } from '../store/authSlice';

import type { LoginFormData } from '../types';
import type { LoginScreenNavigationProp } from '@/navigation/types';

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector(state => state.auth);

  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  // Field-level errors
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});

  // Show password toggle
  const [showPassword, setShowPassword] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userName, setUserName] = useState('');

  /**
   * Clear error on component mount
   */
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  /**
   * Validate email format using Public Suffix List (PSL)
   * Verifies the TLD is ICANN-registered (rejects .or, .rt, .c)
   */
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return false;

    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(email.trim())) return false;

    const domain = email.trim().split('@')[1];
    if (domain == null || domain.trim() === '') return false;

    const parsed = parseDomain(domain);
    return parsed.isIcann === true && parsed.publicSuffix !== null;
  };

  /**
   * Validate form fields
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof LoginFormData, string>> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.email, formData.password]);

  /**
   * Handle form submission
   */
  const handleLogin = useCallback(async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(
        loginAsync({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          rememberMe: formData.rememberMe,
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
      // Error is handled by Redux state and displayed inline
      // No alert needed - error banner will show automatically
      console.error('Login error:', err);
    }
  }, [formData, validateForm, dispatch, navigation]);

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
   * Handle field change
   */
  const handleFieldChange = useCallback(
    (field: keyof LoginFormData, value: string | boolean) => {
      setFormData(prev => ({ ...prev, [field]: value }));

      // Clear field-level error when user types
      if (errors[field] != null && errors[field] !== '') {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }

      // Clear global auth error when user starts typing
      if (error != null) {
        dispatch(clearError());
      }
    },
    [errors, error, dispatch],
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

          {/* Global error message from Redux - Security: Generic message for failed login */}
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
                  Invalid email or password. Please try again.
                </Text>
              </View>
            </View>
          )}

          {/* Email Input */}
          <Input
            label='Email Address'
            placeholder='Enter your email'
            value={formData.email}
            onChangeText={value => handleFieldChange('email', value)}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='email'
            leftIcon={<Icon name='mail-outline' family='Ionicons' size='md' />}
            hasError={errors.email != null && errors.email !== ''}
            errorText={
              typeof errors.email === 'string' && errors.email.trim() !== ''
                ? errors.email
                : undefined
            }
            editable={isLoading === false}
            testID='login-email-input'
            fullWidth
          />

          {/* Password Input */}
          <Input
            label='Password'
            placeholder='Enter your password'
            value={formData.password}
            onChangeText={value => handleFieldChange('password', value)}
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
            hasError={typeof errors.password === 'string' && errors.password.trim() !== ''}
            errorText={
              typeof errors.password === 'string' && errors.password.trim() !== ''
                ? errors.password
                : undefined
            }
            editable={isLoading === false}
            testID='login-password-input'
            containerStyle={styles.passwordInput}
            fullWidth
          />

          {/* Remember Me & Forgot Password Row */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => handleFieldChange('rememberMe', !formData.rememberMe)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: theme.colors.outline,
                    backgroundColor: formData.rememberMe ? theme.colors.primary : 'transparent',
                  },
                ]}
              >
                {formData.rememberMe && (
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

          {/* Login Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={() => {
              void handleLogin();
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
  footer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
