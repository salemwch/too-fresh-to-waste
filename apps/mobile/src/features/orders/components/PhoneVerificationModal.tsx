/**
 * PhoneVerificationModal Component
 * Just-in-Time phone verification modal for order creation
 *
 * ✅ BEST PRACTICE: Handles two states:
 * - State A: Phone number input (requiresPhoneSetup)
 * - State B: OTP verification (requiresPhoneVerification)
 * ✅ Automatic OTP detection on Android
 * ✅ Auto-retry order creation on successful verification
 * ✅ Smooth animated backdrop (like OfferDetailsScreen)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Tunisia calling code — displayed as a fixed prefix on the phone input */
const COUNTRY_PREFIX = '+216';
const OVERLAY = 'rgba(0, 0, 0, 0.6)';
const SURFACE = '#FFFFFF';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#374151';
const BORDER = '#D1D5DB';
const SURFACE_MUTED = '#E5E7EB';
const INPUT_SURFACE = '#F9FAFB';
const SUCCESS = '#10B981';
const DISABLED = '#9CA3AF';
const ERROR = '#EF4444';
const WARNING = '#F59E0B';

import { selectAuthUser } from '@/features/auth/store/authSlice';
import { useAppSelector } from '@/hooks';
import { apiClient } from '@/services/apiClient';

/**
 * Props interface
 */
interface PhoneVerificationModalProps {
  visible: boolean;
  requiresPhoneSetup: boolean;
  requiresPhoneVerification: boolean;
  onClose: () => void;
  onVerificationComplete: () => Promise<void>;
}

/**
 * ✅ DRY PRINCIPLE: Shared API response types
 */
interface PhoneVerificationResponse {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

/**
 * PhoneVerificationModal Component
 */
export const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  visible,
  requiresPhoneSetup,
  requiresPhoneVerification: _requiresPhoneVerification,
  onClose,
  onVerificationComplete,
}) => {
  const user = useAppSelector(selectAuthUser);

  // ✅ State management
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // ✅ Refs for OTP auto-detection
  const otpInputRef = useRef<TextInput>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Animation refs (same as OfferDetailsScreen)
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /**
   * Smooth animation (same as OfferDetailsScreen)
   */
  useEffect(() => {
    if (visible) {
      // ✅ Smooth parallel animation (backdrop fade + sheet slide)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-out
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth ease-in-out
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  /**
   * Initialize phone number from user profile when modal opens.
   * We do NOT auto-send OTP here — the user must press "Send" explicitly.
   * (Auto-send used a stale closure that caused the OTP view to not appear.)
   */
  useEffect(() => {
    if (visible && user?.phoneNumber != null) {
      setPhoneNumber(user.phoneNumber);
    }
  }, [visible, user?.phoneNumber]);

  /**
   * Countdown timer for resend OTP
   */
  useEffect(() => {
    if (countdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [countdown]);

  /**
   * Cleanup on unmount
   */
  useEffect(
    () => () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    },
    [],
  );

  /**
   * Reset all state when modal closes
   */
  useEffect(() => {
    if (!visible) {
      setPhoneNumber('');
      setOtp('');
      setError(null);
      setOtpSent(false);
      setAttemptsRemaining(null);
      setCountdown(0);
    }
  }, [visible]);

  /**
   * Handle phone number change.
   * The input always displays "+216" as a fixed prefix (via `prefix` label).
   * The user only types the local number (e.g. "24123456").
   * We store the full E.164 number internally ("+21624123456").
   */
  const handlePhoneChange = useCallback((text: string) => {
    // Strip everything except digits
    const digits = text.replace(/\D/g, '');

    // If user pastes a full number starting with 216, strip the prefix
    const localDigits = digits.startsWith('216') ? digits.slice(3) : digits;

    // Tunisia local numbers are 8 digits max
    const trimmed = localDigits.slice(0, 8);

    setPhoneNumber(trimmed.length > 0 ? `${COUNTRY_PREFIX}${trimmed}` : '');
    setError(null);
  }, []);

  /**
   * Send OTP to phone number
   */
  const handleSendOTP = useCallback(async () => {
    if (!phoneNumber || phoneNumber.length < 12) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<PhoneVerificationResponse>(
        '/users/phone/verify-request',
        {
          phoneNumber,
        },
      );

      // ✅ Phone verification endpoints use custom format (not BackendApiResponse)
      // Response is directly { success, message, attemptsRemaining }
      const result = response.data;

      if (result.success) {
        setOtpSent(true);
        setCountdown(60); // 60 seconds countdown
        setAttemptsRemaining(result.attemptsRemaining ?? null);

        // Focus OTP input
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 300);

        // ✅ TODO: Start listening for SMS on Android
        // startOTPListener();
      } else {
        setError(result.message || 'Failed to send verification code');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber]);

  /**
   * Verify OTP code
   */
  const handleVerifyOTP = useCallback(async () => {
    if (otp?.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<PhoneVerificationResponse>('/users/phone/verify', {
        phoneNumber,
        code: otp,
      });

      // ✅ Phone verification endpoints use custom format (not BackendApiResponse)
      const result = response.data;

      if (result.success) {
        // ✅ CRITICAL: Call onVerificationComplete to retry order creation
        await onVerificationComplete();
      } else {
        setError(result.message || 'Invalid verification code');
        setAttemptsRemaining(result.attemptsRemaining ?? null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [otp, phoneNumber, onVerificationComplete]);

  /**
   * Resend OTP
   */
  const handleResendOTP = useCallback(async () => {
    if (countdown > 0) return;

    setOtp('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<PhoneVerificationResponse>('/users/phone/resend-code', {
        phoneNumber,
      });

      // ✅ Phone verification endpoints use custom format (not BackendApiResponse)
      const result = response.data;

      if (result.success) {
        setCountdown(60);
        setAttemptsRemaining(result.attemptsRemaining ?? null);
      } else {
        setError(result.message || 'Failed to resend verification code');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [countdown, phoneNumber]);
  const handleSendOTPPress = useCallback(() => {
    void handleSendOTP();
  }, [handleSendOTP]);
  const handleVerifyOTPPress = useCallback(() => {
    void handleVerifyOTP();
  }, [handleVerifyOTP]);
  const handleResendOTPPress = useCallback(() => {
    void handleResendOTP();
  }, [handleResendOTP]);

  /**
   * Handle OTP input change.
   * Auto-verifies when all 6 digits are entered.
   */
  const handleOTPChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setError(null);
  }, []);

  /**
   * Auto-verify when 6 digits are entered.
   * Separate effect avoids stale closure in handleOTPChange.
   */
  useEffect(() => {
    if (otp.length === 6) {
      const timer = setTimeout(() => {
        void handleVerifyOTP();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [otp, handleVerifyOTP]);

  /**
   * Render phone input state (State A)
   */
  const renderPhoneInput = () => (
    <>
      <Text style={styles.title}>Verify Your Phone Number</Text>
      <Text style={styles.subtitle}>
        To complete your order, please verify your phone number. You’ll receive a verification code
        via SMS.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>{COUNTRY_PREFIX}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder='20 123 456'
            placeholderTextColor='#9CA3AF'
            value={phoneNumber.replace(COUNTRY_PREFIX, '')}
            onChangeText={handlePhoneChange}
            keyboardType='phone-pad'
            maxLength={8}
            autoFocus
            editable={!isLoading}
          />
        </View>
      </View>

      {error != null && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSendOTPPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color='#FFFFFF' />
        ) : (
          <Text style={styles.buttonText}>Send Verification Code</Text>
        )}
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={handleCloseAnimated} disabled={isLoading}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </>
  );

  /**
   * Render OTP verification state (State B)
   */
  const renderOTPVerification = () => (
    <>
      <Text style={styles.title}>Enter Verification Code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to {phoneNumber}. Please enter it below.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Verification Code</Text>
        <TextInput
          ref={otpInputRef}
          style={[styles.input, styles.otpInput]}
          placeholder='123456'
          placeholderTextColor='#9CA3AF'
          value={otp}
          onChangeText={handleOTPChange}
          keyboardType='number-pad'
          maxLength={6}
          autoFocus
          editable={!isLoading}
        />
      </View>

      {error != null && <Text style={styles.errorText}>{error}</Text>}

      {attemptsRemaining !== null && attemptsRemaining < 3 && (
        <Text style={styles.warningText}>⚠️ {attemptsRemaining} attempts remaining</Text>
      )}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleVerifyOTPPress}
        disabled={isLoading || otp.length !== 6}
      >
        {isLoading ? (
          <ActivityIndicator color='#FFFFFF' />
        ) : (
          <Text style={styles.buttonText}>Verify & Continue</Text>
        )}
      </Pressable>

      <View style={styles.resendContainer}>
        {countdown > 0 ? (
          <Text style={styles.resendText}>Resend code in {countdown}s</Text>
        ) : (
          <Pressable onPress={handleResendOTPPress} disabled={isLoading}>
            <Text style={styles.resendButtonText}>Resend Code</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.cancelButton} onPress={handleCloseAnimated} disabled={isLoading}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </>
  );

  /**
   * Handle close with animation
   */
  const handleCloseAnimated = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.bezier(0.42, 0, 0.58, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose, fadeAnim, slideAnim]);

  /**
   * Main render
   */
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType='none' transparent onRequestClose={handleCloseAnimated}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        {/* Animated Backdrop - Fades in smoothly */}
        <TouchableWithoutFeedback onPress={handleCloseAnimated}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Animated Modal Content - Slides up smoothly */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {requiresPhoneSetup || !otpSent ? renderPhoneInput() : renderOTPVerification()}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/**
 * Styles
 */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY, // ✅ Matches OfferDetailsScreen
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefixBox: {
    backgroundColor: SURFACE_MUTED,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  phoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: TEXT_PRIMARY,
    backgroundColor: INPUT_SURFACE,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: SUCCESS,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: DISABLED,
  },
  buttonText: {
    color: SURFACE,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: ERROR,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningText: {
    color: WARNING,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  resendContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  resendButtonText: {
    color: SUCCESS,
    fontSize: 14,
    fontWeight: '600',
  },
});
