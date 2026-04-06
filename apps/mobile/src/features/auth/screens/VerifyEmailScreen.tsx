/**
 * Verify Email Screen
 * Email verification status and resend functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';

import { Button, Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { showSuccessToast, showErrorToast } from '@/utils/toast';

import { authService } from '../services/authService';
import { verifyEmailAsync } from '../store/authSlice';

import type { VerifyEmailScreenNavigationProp, VerifyEmailRouteProp } from '@/navigation/types';

interface VerifyEmailScreenProps {
  navigation: VerifyEmailScreenNavigationProp;
  route: VerifyEmailRouteProp;
}

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  // Get email from route params OR Redux state (state-driven approach)
  const { email: routeEmail, token } = route.params;
  const { pendingVerificationEmail } = useAppSelector((state) => state.auth);
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

      // Show success toast
      showSuccessToast('Email Verified', 'You can now access your account');

      // Note: Navigation to Home happens automatically via RootNavigator
      // when flowState changes to AUTHENTICATED
    } catch (err) {
      setVerificationStatus('error');

      let errorMessage = 'Verification failed. The link may be invalid or expired.';
      if (
        err !== null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        errorMessage = (err as { message: string }).message;
      }

      showErrorToast('Verification Failed', errorMessage);
    } finally {
      setIsVerifying(false);
    }
  }, [dispatch, email, token]);

  /**
   * Auto-verify if token is present in URL
   */
  useEffect(() => {
    if (
      typeof token === 'string' &&
      token.trim() !== '' &&
      typeof email === 'string' &&
      email.trim() !== '' &&
      verificationStatus === 'pending'
    ) {
      void handleAutoVerification();
    }
  }, [email, handleAutoVerification, token, verificationStatus]);

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

      showSuccessToast('Verification Email Sent', 'Please check your inbox');

      // Set 60 second cooldown
      setResendCooldown(60);
    } catch (err: unknown) {
      let errorMessage = 'Failed to resend email. Please try again.';
      if (
        err !== null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        errorMessage = (err as { message: string }).message;
      }

      showErrorToast('Resend Failed', errorMessage);

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
      // If mailto: fails, show a helpful message
      showErrorToast('Unable to Open Email', 'Please open your email app manually');
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
                family="Ionicons"
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
          <Text variant="headline" size="lg" weight="semibold" align="center" style={styles.title}>
            {isVerifying
              ? 'Verifying Email...'
              : verificationStatus === 'success'
                ? 'Email Verified!'
                : verificationStatus === 'error'
                  ? 'Verification Failed'
                  : 'Verify Your Email'}
          </Text>

          {/* Content based on verification status */}
          {isVerifying ? (
            <>
              <Text
                variant="body"
                size="md"
                color="secondary"
                align="center"
                style={styles.description}
              >
                Please wait while we verify your email...
              </Text>
              <View style={styles.loadingContainer} />
            </>
          ) : verificationStatus === 'success' ? (
            <>
              <Text
                variant="body"
                size="md"
                color="secondary"
                align="center"
                style={styles.description}
              >
                Your email has been verified successfully!
              </Text>
              <Text
                variant="body"
                size="sm"
                color="secondary"
                align="center"
                style={styles.instructions}
              >
                You can now login to your account and start reducing food waste.
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={handleBackToLogin}
                style={[styles.verifiedButton, styles.actionButtonSpacing]}
              >
                Go to Login
              </Button>
            </>
          ) : verificationStatus === 'error' ? (
            <>
              <Text
                variant="body"
                size="md"
                color="secondary"
                align="center"
                style={styles.description}
              >
                The verification link may be invalid or expired.
              </Text>
              <Text
                variant="body"
                size="sm"
                color="secondary"
                align="center"
                style={styles.instructions}
              >
                Please request a new verification email and try again.
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  void handleResendVerification();
                }}
                loading={isResending}
                disabled={isResending || !canResend || resendCooldown > 0}
                style={[styles.verifiedButton, styles.actionButtonSpacing]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
              </Button>
              <Button
                variant="outline"
                size="md"
                onPress={handleBackToLogin}
                disabled={isResending}
                style={[styles.backButton, outlineButtonStyle]}
              >
                Back to Login
              </Button>
            </>
          ) : (
            <>
              {/* Pending state - waiting for user to verify */}
              <Text
                variant="body"
                size="md"
                color="secondary"
                align="center"
                style={styles.description}
              >
                We&apos;ve sent a verification link to:
              </Text>

              {/* Email Display */}
              <View
                style={[styles.emailContainer, { backgroundColor: theme.colors.surfaceContainer }]}
              >
                <Text variant="body" size="md" weight="semibold" align="center">
                  {email}
                </Text>
              </View>

              {/* Open Email App Button */}
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  void handleOpenEmailApp();
                }}
                style={[styles.verifiedButton, styles.actionButtonSpacing]}
              >
                Open Email App
              </Button>

              {/* Resend Button */}
              <Button
                variant="outline"
                size="md"
                onPress={() => {
                  void handleResendVerification();
                }}
                loading={isResending}
                disabled={isResending || !canResend || resendCooldown > 0}
                style={[styles.resendButton, outlineButtonStyle]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
              </Button>

              {/* Back to Login */}
              <Button
                variant="outline"
                size="md"
                onPress={handleBackToLogin}
                disabled={isResending}
                style={[styles.backButton, outlineButtonStyle]}
              >
                Back to Login
              </Button>
            </>
          )}

          {/* Help Info - Only show when not verified */}
          {verificationStatus !== 'success' && (
            <View style={[styles.helpContainer, { borderTopColor: theme.colors.outlineVariant }]}>
              <Icon
                name="information-circle-outline"
                family="Ionicons"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
              <View style={styles.helpTextContainer}>
                <Text
                  variant="body"
                  size="xs"
                  weight="medium"
                  color="secondary"
                  style={styles.helpTitle}
                >
                  Didn&lsquo;t receive the email?
                </Text>
                <Text variant="body" size="xs" color="secondary" style={styles.helpText}>
                  • Check your spam or junk folder{'\n'}• Make sure you entered the correct email
                  address{'\n'}• Wait a few minutes and try resending{'\n'}• Contact{' '}
                  <Text
                    variant="body"
                    size="xs"
                    weight="semibold"
                    onPress={() => {
                      void Linking.openURL('mailto:support@toofreshtowaste.com');
                    }}
                    style={[styles.supportLink, { color: theme.colors.primary }]}
                  >
                    support
                  </Text>{' '}
                  if the problem persists
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
    marginLeft: 12,
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
});
