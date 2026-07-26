/**
 * Verify Email Screen
 * Email verification status and resend functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';

import { Button, Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { showSuccessToast } from '@/utils/toast';

import { authService } from '../services/authService';
import { verifyEmailAsync } from '../store/authSlice';

import type { VerifyEmailScreenNavigationProp, VerifyEmailRouteProp } from '@/navigation/types';

interface VerifyEmailScreenProps {
  navigation: VerifyEmailScreenNavigationProp;
  route: VerifyEmailRouteProp;
}

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // Get email from route params OR Redux state (state-driven approach)
  const { email: routeEmail, token, status: routeStatus } = route.params;
  const { pendingVerificationEmail } = useAppSelector(state => state.auth);
  const email =
    typeof routeEmail === 'string' && routeEmail.trim() !== ''
      ? routeEmail
      : typeof pendingVerificationEmail === 'string' && pendingVerificationEmail.trim() !== ''
        ? pendingVerificationEmail
        : '';

  // State
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>(
    'pending',
  );
  const [inlineError, setInlineError] = useState<string | null>(null);
  const outlineButtonStyle = { backgroundColor: theme.colors.surface };

  /**
   * Handle automatic verification when token is present
   * Uses verifyEmailAsync for auto-login (user goes directly to Home)
   */
  const handleAutoVerification = useCallback(async () => {
    setIsVerifying(true);

    try {
      // ✅ AUTO-LOGIN: verifyEmailAsync stores tokens and sets AUTHENTICATED state
      // RootNavigator will automatically navigate to Home screen
      await dispatch(verifyEmailAsync({ email, token: token! })).unwrap();

      setVerificationStatus('success');
    } catch {
      setVerificationStatus('error');
      setInlineError(t('verifyEmail.invalidOrExpired'));
    } finally {
      setIsVerifying(false);
    }
  }, [dispatch, email, token]);

  /**
   * Auto-verify when a token is present (Universal Link or manual entry).
   * Email is not required — backend validates by token alone when email is absent.
   */
  useEffect(() => {
    if (typeof token === 'string' && token.trim() !== '' && verificationStatus === 'pending') {
      void handleAutoVerification();
    }
  }, [handleAutoVerification, token, verificationStatus]);

  // Handle web fallback: user verified in browser and was redirected back
  // via foodwaste://verify-email?status=success. Email is already verified
  // but the app has no tokens — navigate to Login with a success message.
  useEffect(() => {
    if (routeStatus === 'success' && verificationStatus === 'pending') {
      setVerificationStatus('success');
      showSuccessToast('Email Verified', 'Please log in to continue');
      navigation.navigate('Login');
    }
  }, [routeStatus, verificationStatus, navigation]);

  /**
   * Cooldown timer for resend button
   */
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    setCanResend(true);
    return undefined;
  }, [resendCooldown]);

  /**
   * Handle resend verification email
   */
  const handleResendVerification = useCallback(async () => {
    if (!canResend || resendCooldown > 0) return;

    setIsResending(true);
    setCanResend(false);

    try {
      await authService.resendVerificationEmail(email);

      setInlineError(null);
      showSuccessToast(t('auth.verificationEmailSent'));

      // Set 60 second cooldown
      setResendCooldown(60);
    } catch {
      setInlineError(t('verifyEmail.failedToResend'));
      setCanResend(true);
    } finally {
      setIsResending(false);
    }
  }, [email, canResend, resendCooldown]);

  /**
   * Navigate back to login
   */
  const handleBackToLogin = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  /**
   * Open email app to check verification email
   * Uses mailto: scheme which opens the default email app or shows chooser
   */
  const handleOpenEmailApp = useCallback(async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      setInlineError(t('verifyEmail.unableToOpenEmail'));
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor:
                    verificationStatus === 'success'
                      ? theme.colors.primaryContainer
                      : verificationStatus === 'error'
                        ? theme.colors.errorContainer
                        : theme.colors.warningContainer,
                },
              ]}
            >
              <Icon
                name={
                  verificationStatus === 'success'
                    ? 'checkmark-circle-outline'
                    : verificationStatus === 'error'
                      ? 'close-circle-outline'
                      : 'mail-outline'
                }
                family='Ionicons'
                size={64}
                color={
                  verificationStatus === 'success'
                    ? theme.colors.primary
                    : verificationStatus === 'error'
                      ? theme.colors.error
                      : theme.colors.warning
                }
              />
            </View>
          </View>

          {/* Title */}
          <Text variant='headline' size='lg' weight='semibold' align='center' style={styles.title}>
            {isVerifying
              ? t('verifyEmail.verifying')
              : verificationStatus === 'success'
                ? t('verifyEmail.verifiedTitle')
                : verificationStatus === 'error'
                  ? t('verifyEmail.failedTitle')
                  : t('verifyEmail.title')}
          </Text>

          {/* Content based on verification status */}
          {isVerifying ? (
            <>
              <Text
                variant='body'
                size='md'
                color='secondary'
                align='center'
                style={styles.description}
              >
                {t('verifyEmail.waitMessage')}
              </Text>
              <View style={styles.loadingContainer} />
            </>
          ) : verificationStatus === 'success' ? (
            <>
              <Text
                variant='body'
                size='md'
                color='secondary'
                align='center'
                style={styles.description}
              >
                {t('verifyEmail.successMessage')}
              </Text>
              <Text
                variant='body'
                size='sm'
                color='secondary'
                align='center'
                style={styles.instructions}
              >
                {t('verifyEmail.loggingIn')}
              </Text>
            </>
          ) : verificationStatus === 'error' ? (
            <>
              <Text
                variant='body'
                size='md'
                color='secondary'
                align='center'
                style={styles.description}
              >
                {t('verifyEmail.failedMessage')}
              </Text>
              <Text
                variant='body'
                size='sm'
                color='secondary'
                align='center'
                style={styles.instructions}
              >
                {t('verifyEmail.failedInstruction')}
              </Text>
              <Button
                variant='primary'
                size='lg'
                onPress={() => {
                  void handleResendVerification();
                }}
                loading={isResending}
                disabled={isResending || !canResend || resendCooldown > 0}
                style={[styles.verifiedButton, styles.actionButtonSpacing]}
              >
                {resendCooldown > 0
                  ? t('verifyEmail.resendCooldown', { seconds: resendCooldown })
                  : t('verifyEmail.resendButton')}
              </Button>
              <Button
                variant='outline'
                size='md'
                onPress={handleBackToLogin}
                disabled={isResending}
                style={[styles.backButton, outlineButtonStyle]}
              >
                {t('verifyEmail.backToLogin')}
              </Button>
            </>
          ) : (
            <>
              {/* Pending state - waiting for user to verify */}
              <Text
                variant='body'
                size='md'
                color='secondary'
                align='center'
                style={styles.description}
              >
                {t('verifyEmail.sentTo')}
              </Text>

              {/* Email Display */}
              <View
                style={[styles.emailContainer, { backgroundColor: theme.colors.surfaceContainer }]}
              >
                <Text variant='body' size='md' weight='semibold' align='center'>
                  {email}
                </Text>
              </View>

              {/* Open Email App Button */}
              <Button
                variant='primary'
                size='lg'
                onPress={() => {
                  void handleOpenEmailApp();
                }}
                style={[styles.verifiedButton, styles.actionButtonSpacing]}
              >
                {t('verifyEmail.openEmailApp')}
              </Button>

              {/* Resend Button */}
              <Button
                variant='outline'
                size='md'
                onPress={() => {
                  void handleResendVerification();
                }}
                loading={isResending}
                disabled={isResending || !canResend || resendCooldown > 0}
                style={[styles.resendButton, outlineButtonStyle]}
              >
                {resendCooldown > 0
                  ? t('verifyEmail.resendCooldown', { seconds: resendCooldown })
                  : t('verifyEmail.resendButton')}
              </Button>

              {/* Already verified (user verified on web, came back to app manually) */}
              <Button
                variant='outline'
                size='md'
                onPress={handleBackToLogin}
                disabled={isResending}
                style={[styles.backButton, outlineButtonStyle]}
              >
                {t('verifyEmail.alreadyVerified')}
              </Button>
            </>
          )}

          {/* Inline error */}
          {inlineError !== null && (
            <View
              style={[
                styles.inlineErrorBox,
                {
                  backgroundColor: theme.colors.errorContainer ?? '#FEE2E2',
                  borderColor: theme.colors.error,
                },
              ]}
            >
              <Icon
                name='alert-circle-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.error}
              />
              <Text variant='body' size='sm' style={{ color: theme.colors.error, flex: 1 }}>
                {inlineError}
              </Text>
            </View>
          )}

          {/* Help Info - Only show when not verified */}
          {verificationStatus !== 'success' && (
            <View style={[styles.helpContainer, { borderTopColor: theme.colors.outlineVariant }]}>
              <Icon
                name='information-circle-outline'
                family='Ionicons'
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
              <View style={styles.helpTextContainer}>
                <Text
                  variant='body'
                  size='xs'
                  weight='medium'
                  color='secondary'
                  style={styles.helpTitle}
                >
                  {t('verifyEmail.helpTitle')}
                </Text>
                <Text variant='body' size='xs' color='secondary' style={styles.helpText}>
                  {t('verifyEmail.helpTips')}
                  {'\n'}
                  {t('verifyEmail.helpSupport')}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
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
  card: {
    padding: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 16,
  },
  description: {
    marginBottom: 16,
    lineHeight: 22,
  },
  emailContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  instructions: {
    lineHeight: 20,
  },
  verifiedButton: {
    marginBottom: 12,
  },
  actionButtonSpacing: {
    marginTop: 24,
  },
  resendButton: {
    marginBottom: 8,
  },
  backButton: {
    marginBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 24,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 24,
    borderTopWidth: 1,
  },
  helpTextContainer: {
    flex: 1,
    marginStart: 12,
  },
  helpTitle: {
    marginBottom: 8,
  },
  helpText: {
    lineHeight: 18,
  },
  supportLink: {
    textDecorationLine: 'underline',
  },
  inlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
});
