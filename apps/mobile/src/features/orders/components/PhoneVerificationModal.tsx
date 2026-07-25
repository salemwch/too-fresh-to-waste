/**
 * PhoneVerificationModal Component
 * Collects phone number before order creation.
 * OTP verification is disabled until Twilio is configured.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

import { selectAuthUser, updateUser } from '@/features/auth/store/authSlice';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { apiClient } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COUNTRY_PREFIX = '+216';
const PHONE_LOCAL_DIGITS = 8;
const PHONE_FULL_LENGTH = COUNTRY_PREFIX.length + PHONE_LOCAL_DIGITS;
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

interface PhoneVerificationModalProps {
  visible: boolean;
  requiresPhoneSetup: boolean;
  requiresPhoneVerification: boolean;
  onClose: () => void;
  onVerificationComplete: () => Promise<void>;
}

export const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  visible,
  onClose,
  onVerificationComplete,
}) => {
  const { t } = useTranslation();
  const user = useAppSelector(selectAuthUser);
  const dispatch = useAppDispatch();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
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
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  useEffect(() => {
    if (visible && user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
    }
  }, [visible, user?.phoneNumber]);

  useEffect(() => {
    if (!visible) {
      setPhoneNumber('');
      setError(null);
    }
  }, [visible]);

  const handlePhoneChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '');
    const localDigits = digits.startsWith('216') ? digits.slice(3) : digits;
    const trimmed = localDigits.slice(0, 8);
    setPhoneNumber(trimmed.length > 0 ? `${COUNTRY_PREFIX}${trimmed}` : '');
    setError(null);
  }, []);

  const handleSavePhone = useCallback(async () => {
    if (!phoneNumber || phoneNumber.length < PHONE_FULL_LENGTH) {
      setError(`Please enter a valid ${PHONE_LOCAL_DIGITS}-digit phone number`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.patch('/users/profile', { phone: phoneNumber });
      dispatch(updateUser({ phoneNumber }));
      await onVerificationComplete();
    } catch (err) {
      Logger.error('[PhoneModal] Failed to save phone', {}, err instanceof Error ? err : undefined);
      const message = 'Failed to save your phone number. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, onVerificationComplete, dispatch]);

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

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType='none' transparent onRequestClose={handleCloseAnimated}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback accessibilityRole='button' onPress={handleCloseAnimated}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>{t('orders.enterPhoneTitle')}</Text>
          <Text style={styles.subtitle}>{t('orders.enterPhoneSubtitle')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('orders.phoneNumber')}</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>{COUNTRY_PREFIX}</Text>
              </View>
              <TextInput
                accessibilityLabel={t('orders.a11yPhoneInput')}
                accessibilityHint={`Enter your ${PHONE_LOCAL_DIGITS}-digit phone number`}
                style={[styles.input, styles.phoneInput]}
                placeholder={t('orders.phonePlaceholder')}
                placeholderTextColor='#9CA3AF'
                value={phoneNumber.replace(COUNTRY_PREFIX, '')}
                onChangeText={handlePhoneChange}
                keyboardType='phone-pad'
                maxLength={PHONE_LOCAL_DIGITS}
                autoFocus
                editable={!isLoading}
              />
            </View>
          </View>

          {error != null && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            accessibilityRole='button'
            style={[
              styles.button,
              (isLoading || phoneNumber.length < PHONE_FULL_LENGTH) && styles.buttonDisabled,
            ]}
            onPress={() => {
              void handleSavePhone();
            }}
            disabled={isLoading || phoneNumber.length < PHONE_FULL_LENGTH}
          >
            {isLoading ? (
              <ActivityIndicator color='#FFFFFF' />
            ) : (
              <Text style={styles.buttonText}>Confirm</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole='button'
            style={styles.cancelButton}
            onPress={handleCloseAnimated}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY,
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
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
});
