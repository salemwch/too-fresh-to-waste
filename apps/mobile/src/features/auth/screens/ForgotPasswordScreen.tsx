/**
 * Forgot Password Screen
 * Password reset request with email verification
 */

import { yupResolver } from '@hookform/resolvers/yup';
import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import { Button, Input, Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/utils/validation/schemas';

import { authService } from '../services/authService';

import type { ForgotPasswordScreenNavigationProp } from '@/navigation/types';

interface ForgotPasswordScreenProps {
  navigation: ForgotPasswordScreenNavigationProp;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  // React Hook Form setup with Yup validation
  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues: {
      email: '',
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  /**
   * Handle password reset request (React Hook Form automatically validates)
   */
  const onSubmit = useCallback(async (formData: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      await authService.forgotPassword(formData.email.trim().toLowerCase());
      // Mark as sent - UI will show success state
      setIsEmailSent(true);
    } catch {
      // For security, don't reveal if email exists or not
      // Still show success message
      setIsEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle resend email
   */
  const handleResendEmail = useCallback(async () => {
    setIsEmailSent(false);
    const email = getValues('email');
    if (email) {
      await onSubmit({ email });
    }
  }, [getValues, onSubmit]);

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
              {t('forgotPassword.checkYourEmail')}
            </Text>

            <Text
              variant='body'
              size='md'
              color='secondary'
              align='center'
              style={styles.successMessage}
            >
              {t('forgotPassword.emailSentTo')}
            </Text>

            <Text variant='body' size='md' weight='semibold' align='center' style={styles.email}>
              {getValues('email')}
            </Text>

            <Text
              variant='body'
              size='sm'
              color='secondary'
              align='center'
              style={styles.instructions}
            >
              {t('forgotPassword.linkExpiry')}
            </Text>

            <Button variant='primary' size='lg' onPress={handleBackToLogin} style={styles.button}>
              {t('forgotPassword.backToLogin')}
            </Button>

            <Button
              variant='outline'
              size='md'
              onPress={() => {
                void handleResendEmail();
              }}
              loading={isLoading}
              disabled={isLoading}
              style={styles.resendButton}
            >
              {t('forgotPassword.resendEmail')}
            </Button>

            <View style={[styles.helpContainer, { borderTopColor: theme.colors.outlineVariant }]}>
              <Icon
                name='information-circle-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant='body' size='xs' color='secondary' style={styles.helpText}>
                {t('forgotPassword.checkSpam')}
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
            {t('forgotPassword.title')}
          </Text>

          <Text variant='body' size='md' color='secondary' align='center' style={styles.subtitle}>
            {t('forgotPassword.description')}
          </Text>

          {/* Email Input */}
          <Controller
            control={control}
            name='email'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.emailLabel')}
                placeholder={t('auth.emailPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType='email-address'
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='email'
                autoFocus
                leftIcon='mail-outline'
                leftIconFamily='Ionicons'
                hasError={!!formErrors.email}
                errorText={formErrors.email?.message}
                editable={!isLoading}
                testID='forgot-password-email-input'
              />
            )}
          />

          {/* Reset Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={() => {
              void handleSubmit(onSubmit)();
            }}
            loading={isLoading}
            disabled={isLoading}
            style={styles.button}
            testID='forgot-password-submit-button'
          >
            {t('forgotPassword.sendResetLink')}
          </Button>

          {/* Back to Login */}
          <Button
            variant='ghost'
            size='md'
            onPress={handleBackToLogin}
            disabled={isLoading}
            style={styles.backButton}
          >
            {t('forgotPassword.backToLogin')}
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
            {t('forgotPassword.securityNote')}
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
