/**
 * Verify Phone Screen
 * Phone number verification with SMS code input
 * Features: OTP input, auto-verification, resend with cooldown, animations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmsRetriever from 'react-native-sms-retriever';

import { Button, Text, Icon } from '@/design-system/components/atoms';
import { OTPInput } from '@/design-system/components/molecules/OTPInput';
import { useTheme } from '@/design-system/providers';
import { showAlert, showSuccessAlert, showErrorAlert } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';

import type { VerifyPhoneScreenProps } from '@/navigation/types';

export const VerifyPhoneScreen: React.FC<VerifyPhoneScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { phoneNumber: paramPhoneNumber, fromEmailVerification } = route.params ?? {};
  const { tokens } = useAuth();

  // State
  const [phoneNumber] = useState(paramPhoneNumber ?? '');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [hasCodeBeenSent, setHasCodeBeenSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const phoneIconRotation = useSharedValue(0);
  const successScale = useSharedValue(0);

  // Phone icon pulse animation
  useEffect(() => {
    phoneIconRotation.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(10, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [phoneIconRotation]);

  const phoneIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${phoneIconRotation.value}deg` }],
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

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
   * SMS OTP Autofill (Android only)
   * Uses SMS Retriever API to automatically read and fill OTP from incoming SMS
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !hasCodeBeenSent) {
      return undefined;
    }

    let isListenerActive = true;

    const startSmsListener = async () => {
      try {
        // Start SMS retriever
        const registered = await SmsRetriever.startSmsRetriever();

        if (registered === true && isListenerActive) {
          Logger.info('SMS Retriever started successfully');

          // Add listener for incoming SMS
          void SmsRetriever.addSmsListener((event: { message?: string } | null) => {
            if (!isListenerActive) return;

            try {
              if (event?.message !== undefined && event.message !== null) {
                Logger.info('SMS received', {
                  messagePreview: event.message.substring(0, 50),
                });

                // Extract 6-digit code from SMS using regex
                // Matches patterns like: "123456", "Your code is 123456", "OTP: 123456"
                const otpMatch = /(\d{6})/.exec(event.message);

                if (otpMatch?.[1] !== undefined) {
                  const extractedCode = otpMatch[1];
                  Logger.info('OTP extracted from SMS', { code: extractedCode });

                  // Auto-fill the code
                  setCode(extractedCode);

                  // Clear error if any
                  setError(null);

                  // Note: Auto-verification will trigger via the useEffect hook above
                  // when code.length === 6
                }
              }
            } catch (parseError) {
              Logger.error('Failed to parse SMS message', { error: parseError });
            } finally {
              // Remove listener after reading SMS
              SmsRetriever.removeSmsListener();
            }
          });
        }
      } catch (error) {
        // Graceful fallback: user can still manually enter OTP
        Logger.warn('SMS Retriever failed to start (user can still manually enter code)', {
          error,
        });
      }
    };

    void startSmsListener();

    // Cleanup: remove listener on unmount
    return () => {
      isListenerActive = false;
      try {
        SmsRetriever.removeSmsListener();
        Logger.info('SMS Retriever listener removed');
      } catch (error) {
        // Ignore cleanup errors
        Logger.debug('SMS Retriever cleanup error (non-critical)', { error });
      }
    };
  }, [hasCodeBeenSent]); // Re-run when code is sent/resent

  /**
   * Send verification code via SMS
   */
  const handleSendVerificationCode = useCallback(async () => {
    if (!phoneNumber) {
      showErrorAlert('Error', 'Please provide a phone number');
      return;
    }

    if (!tokens?.accessToken) {
      showErrorAlert('Error', 'Authentication required. Please log in again.');
      navigation.navigate('Login');
      return;
    }

    setIsSendingCode(true);
    setError(null);
    setCode(''); // Reset code

    try {
      const response = await authService.sendPhoneVerification(
        { phoneNumber, method: 'sms' },
        tokens.accessToken,
      );

      Logger.info('Phone verification code sent', { phoneNumber });

      setHasCodeBeenSent(true);
      setResendCooldown(60);
      setCanResend(false);

      showSuccessAlert(
        'Code Sent!',
        `A 6-digit verification code has been sent to ${phoneNumber}. ${
          response.attemptsRemaining
            ? `You have ${response.attemptsRemaining} attempts remaining.`
            : ''
        }`,
      );
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(
        err,
        'Failed to send verification code. Please try again.',
      );

      Logger.error('Failed to send phone verification code', { error: err });

      setError(errorMessage);

      showErrorAlert('Failed to Send Code', errorMessage);
    } finally {
      setIsSendingCode(false);
    }
  }, [phoneNumber, tokens, navigation]);

  /**
   * Auto-send verification code on mount if phone number is available
   */
  useEffect(() => {
    if (
      typeof phoneNumber === 'string' &&
      phoneNumber.trim() !== '' &&
      !hasCodeBeenSent &&
      tokens?.accessToken
    ) {
      void handleSendVerificationCode();
    }
  }, [handleSendVerificationCode, hasCodeBeenSent, phoneNumber, tokens?.accessToken]);

  /**
   * Verify the entered code
   */
  const handleVerifyCode = useCallback(async () => {
    if (code?.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    if (!tokens?.accessToken) {
      showErrorAlert('Error', 'Authentication required. Please log in again.');
      navigation.navigate('Login');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await authService.confirmPhoneVerification({ phoneNumber, code }, tokens.accessToken);

      Logger.info('Phone verified successfully', { phoneNumber });

      // Success animation
      successScale.value = withSequence(
        withTiming(1.2, { duration: 300 }),
        withTiming(1, { duration: 200 }),
      );

      // Navigate based on context
      setTimeout(() => {
        if (fromEmailVerification === true) {
          // Coming from email verification, go to main app
          showSuccessAlert(
            'Verification Complete!',
            'Your phone number has been verified. Welcome to the app!',
          );

          // Navigate after showing success
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }, 2000);
        } else {
          showSuccessAlert('Phone Verified!', 'Your phone number has been successfully verified.');

          // Navigate back after showing success
          setTimeout(() => {
            navigation.goBack();
          }, 2000);
        }
      }, 500);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(
        err,
        'Verification failed. Please check your code and try again.',
      );

      Logger.error('Phone verification failed', { error: err });

      setError(errorMessage);
      setCode(''); // Reset code on error

      showErrorAlert('Verification Failed', errorMessage);
    } finally {
      setIsVerifying(false);
    }
  }, [code, phoneNumber, tokens, navigation, fromEmailVerification, successScale]);

  /**
   * Auto-verify when code is complete
   */
  useEffect(() => {
    if (code.length === 6 && !isVerifying) {
      void handleVerifyCode();
    }
  }, [code, handleVerifyCode, isVerifying]);

  /**
   * Resend verification code
   */
  const handleResendCode = useCallback(async () => {
    if (!canResend || resendCooldown > 0) return;

    if (!tokens?.accessToken) {
      showErrorAlert('Error', 'Authentication required. Please log in again.');
      navigation.navigate('Login');
      return;
    }

    setIsSendingCode(true);
    setError(null);
    setCode(''); // Reset code

    try {
      const response = await authService.resendPhoneVerification(
        { phoneNumber, method: 'sms' },
        tokens.accessToken,
      );

      Logger.info('Phone verification code resent', { phoneNumber });

      showSuccessAlert(
        'Code Resent!',
        `A new verification code has been sent to ${phoneNumber}. ${
          response.attemptsRemaining
            ? `You have ${response.attemptsRemaining} attempts remaining.`
            : ''
        }`,
      );

      setResendCooldown(60);
      setCanResend(false);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to resend code. Please try again.');

      Logger.error('Failed to resend phone verification code', { error: err });

      setError(errorMessage);

      showErrorAlert('Resend Failed', errorMessage);
    } finally {
      setIsSendingCode(false);
    }
  }, [phoneNumber, canResend, resendCooldown, tokens, navigation]);

  /**
   * Handle back navigation
   */
  const handleBack = useCallback(() => {
    if (fromEmailVerification === true) {
      showAlert(
        'Verification Required',
        'Phone verification is mandatory to complete your registration. You must verify your phone number before you can log in.',
        undefined,
        { type: 'warning' },
      );
    } else {
      navigation.goBack();
    }
  }, [navigation, fromEmailVerification]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with animated phone icon */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
          <Animated.View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.primaryContainer },
              phoneIconAnimatedStyle,
            ]}
          >
            <Icon name="phone" size={48} color={theme.colors.primary} />
          </Animated.View>

          <Animated.View style={successAnimatedStyle}>
            {code.length === 6 && !error && (
              <View
                style={[styles.successBadge, { backgroundColor: theme.colors.successContainer }]}
              >
                <Icon name="check-circle" size={32} color={theme.colors.success} />
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* Title and Description */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.titleContainer}>
          <Text variant="headline.large" style={styles.title}>
            Verify Your Phone
          </Text>
          <Text
            variant="body.large"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {hasCodeBeenSent
              ? `Enter the 6-digit code sent to ${phoneNumber}`
              : "We'll send you a verification code to confirm your phone number"}
          </Text>
        </Animated.View>

        {/* OTP Input */}
        {hasCodeBeenSent && (
          <Animated.View entering={ZoomIn.delay(300)} style={styles.otpContainer}>
            <OTPInput
              value={code}
              onChange={setCode}
              error={!!error}
              disabled={isVerifying}
              autoFocus
            />

            {error && (
              <Animated.View entering={FadeInDown} style={styles.errorContainer}>
                <Icon name="alert-circle" size={16} color={theme.colors.error} />
                <Text
                  variant="body.small"
                  style={[styles.errorText, { color: theme.colors.error }]}
                >
                  {error}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.buttonContainer}>
          {!hasCodeBeenSent ? (
            <Button
              onPress={() => {
                void handleSendVerificationCode();
              }}
              loading={isSendingCode}
              disabled={!phoneNumber || isSendingCode}
              style={styles.button}
            >
              Send Verification Code
            </Button>
          ) : (
            <>
              <Button
                onPress={() => {
                  void handleVerifyCode();
                }}
                loading={isVerifying}
                disabled={code.length !== 6 || isVerifying}
                style={styles.button}
              >
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>

              {/* Resend Button */}
              <View style={styles.resendContainer}>
                <Text
                  variant="body.medium"
                  style={[styles.resendText, { color: theme.colors.onSurfaceVariant }]}
                >
                  Didn&apos;t receive the code?
                </Text>
                <Button
                  variant="text"
                  onPress={() => {
                    void handleResendCode();
                  }}
                  disabled={!canResend || resendCooldown > 0 || isSendingCode}
                  loading={isSendingCode}
                  style={styles.resendButton}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </Button>
              </View>
            </>
          )}

          {/* Back Button - only show if not from email verification */}
          {fromEmailVerification !== true && (
            <Button
              variant="text"
              onPress={handleBack}
              disabled={isVerifying || isSendingCode}
              style={styles.backButton}
            >
              Back
            </Button>
          )}
        </Animated.View>

        {/* Help Text */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.helpContainer}>
          <Icon name="info" size={20} color={theme.colors.onSurfaceVariant} />
          <Text
            variant="body.small"
            style={[styles.helpText, { color: theme.colors.onSurfaceVariant }]}
          >
            {fromEmailVerification === true
              ? 'Phone verification is mandatory. Codes expire after 10 minutes. You have up to 5 attempts per code.'
              : 'Verification codes expire after 10 minutes. You have up to 5 attempts per code.'}
          </Text>
        </Animated.View>
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
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successBadge: {
    position: 'absolute',
    bottom: 0,
    right: -8,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  otpContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  errorText: {
    flex: 1,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    width: '100%',
  },
  resendContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  resendText: {
    textAlign: 'center',
  },
  resendButton: {
    marginTop: -8,
  },
  backButton: {
    marginTop: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 'auto',
  },
  helpText: {
    flex: 1,
    lineHeight: 20,
  },
});
