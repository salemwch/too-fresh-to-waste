/**
 * Forgot Password Screen
 * Password reset request with email verification
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import { Button, Input, Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { authService } from '../services/authService';

import type { ForgotPasswordScreenNavigationProp } from '@/navigation/types';

interface ForgotPasswordScreenProps {
  navigation: ForgotPasswordScreenNavigationProp;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  // Form state
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);

  /**
   * Validate email format
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Handle password reset request
   */
  const handleResetPassword = useCallback(async () => {
    // Clear previous errors
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      // Mark as sent - UI will show success state
      setIsEmailSent(true);
    } catch (err: any) {
      // For security, don't reveal if email exists or not
      // Still show success message
      setIsEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  /**
   * Handle resend email
   */
  const handleResendEmail = useCallback(async () => {
    setIsEmailSent(false);
    await handleResetPassword();
  }, [handleResetPassword]);

  /**
   * Navigate back to login
   */
  const handleBackToLogin = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Success state - email sent
  if (isEmailSent) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.successCard}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.successContainer }]}>
                <Icon
                  name='checkmark-circle'
                  family='Ionicons'
                  size={64}
                  color={theme.colors.success}
                />
              </View>
            </View>

            <Text
              variant='headline'
              size='lg'
              weight='semibold'
              align='center'
              style={styles.successTitle}
            >
              Check Your Email
            </Text>

            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.successMessage}
            >
              We've sent a password reset link to:
            </Text>

            <Text variant='body' size='md' weight='semibold' align='center' style={styles.email}>
              {email}
            </Text>

            <Text
              variant='body'
              size='sm'
              color='secondary'
              align='center'
              style={styles.instructions}
            >
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </Text>

            <Button variant='primary' size='lg' onPress={handleBackToLogin} style={styles.button}>
              Back to Login
            </Button>

            <Button
              variant='outline'
              size='md'
              onPress={handleResendEmail}
              loading={isLoading}
              disabled={isLoading}
              style={styles.resendButton}
            >
              Resend Email
            </Button>

            <View style={styles.helpContainer}>
              <Icon
                name='information-circle-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant='body' size='xs' color='secondary' style={styles.helpText}>
                Didn't receive the email? Check your spam folder or try resending.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // Initial state - request reset
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
              <Icon name='lock-closed' family='Ionicons' size={48} color={theme.colors.primary} />
            </View>
          </View>

          <Text variant='headline' size='lg' weight='semibold' align='center' style={styles.title}>
            Forgot Password?
          </Text>

          <Text variant='body' size='md' color='secondary' align='center' style={styles.subtitle}>
            No worries! Enter your email address and we'll send you a link to reset your password.
          </Text>

          {/* Error message */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
              <Text variant='body' size='sm' style={{ color: theme.colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          )}

          {/* Email Input */}
          <Input
            label='Email Address'
            placeholder='Enter your email'
            value={email}
            onChangeText={value => {
              setEmail(value);
              setError(null);
            }}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='email'
            autoFocus
            leftIcon='mail-outline'
            leftIconFamily='Ionicons'
            error={error || undefined}
            hasError={!!error}
            editable={!isLoading}
            testID='forgot-password-email-input'
          />

          {/* Reset Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={handleResetPassword}
            loading={isLoading}
            disabled={isLoading || !email.trim()}
            style={styles.button}
            testID='forgot-password-submit-button'
          >
            Send Reset Link
          </Button>

          {/* Back to Login */}
          <Button
            variant='ghost'
            size='md'
            onPress={handleBackToLogin}
            disabled={isLoading}
            style={styles.backButton}
          >
            Back to Login
          </Button>
        </Card>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Icon
            name='shield-checkmark-outline'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant='body' size='xs' color='secondary' style={styles.securityText}>
            For security reasons, the reset link will expire in 1 hour. We'll never share your email
            with anyone else.
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
  successCard: {
    padding: 32,
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
  successTitle: {
    marginBottom: 16,
  },
  subtitle: {
    marginBottom: 24,
    lineHeight: 22,
  },
  successMessage: {
    marginBottom: 8,
  },
  email: {
    marginBottom: 16,
  },
  instructions: {
    marginBottom: 32,
    lineHeight: 20,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
  },
  resendButton: {
    marginTop: 12,
  },
  backButton: {
    marginTop: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  helpText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
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
});
