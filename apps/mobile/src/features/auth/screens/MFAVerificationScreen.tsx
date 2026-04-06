/**
 * MFA Verification Screen
 * Two-Factor Authentication code verification
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Button, Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { showAlert, showSuccessAlert, showErrorAlert } from '@/utils/alert';

import { verifyMFAAsync } from '../store/authSlice';

import type {
  MFAVerificationScreenNavigationProp,
  MFAVerificationRouteProp,
} from '@/navigation/types';

interface MFAVerificationScreenProps {
  navigation: MFAVerificationScreenNavigationProp;
  route: MFAVerificationRouteProp;
}

const CODE_LENGTH = 6;

export const MFAVerificationScreen: React.FC<MFAVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector(state => state.auth);

  const { mfaToken } = route.params;

  // State
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Refs for input fields
  const inputRefs = useRef<(TextInput | null)[]>([]);

  /**
   * Auto-focus first input on mount
   */
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  /**
   * Handle MFA verification
   */
  const handleVerifyMFA = useCallback(
    async (verificationCode?: string) => {
      const fullCode = verificationCode ?? code.join('');

      if (fullCode.length !== CODE_LENGTH) {
        showErrorAlert('Invalid Code', 'Please enter all 6 digits.');
        return;
      }

      try {
        await dispatch(
          verifyMFAAsync({
            mfaToken,
            code: fullCode,
          }),
        ).unwrap();

        // Success! RootNavigator will automatically navigate to MainStack
        showSuccessAlert('Success', 'Authentication successful!');
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error && err.message.length > 0
            ? err.message
            : 'Invalid verification code. Please try again.';

        showErrorAlert('Verification Failed', errorMessage);

        // Clear code and focus first input
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    },
    [code, dispatch, mfaToken],
  );

  /**
   * Handle code change
   */
  const handleCodeChange = useCallback(
    (value: string, index: number) => {
      // Only allow digits
      if (value.length > 0 && !/^\d+$/.test(value)) {
        return;
      }

      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input
      if (value.length > 0 && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all fields are filled
      if (index === CODE_LENGTH - 1 && value.length > 0) {
        const fullCode = newCode.join('');
        if (fullCode.length === CODE_LENGTH) {
          void handleVerifyMFA(fullCode);
        }
      }
    },
    [code, handleVerifyMFA],
  );

  /**
   * Handle backspace
   */
  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && code[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  /**
   * Handle manual submit
   */
  const handleSubmit = useCallback(() => {
    void handleVerifyMFA();
  }, [handleVerifyMFA]);

  /**
   * Clear code
   */
  const handleClear = useCallback(() => {
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  }, []);

  /**
   * Navigate back to login
   */
  const handleBackToLogin = useCallback(() => {
    showAlert(
      'Cancel Verification',
      'Are you sure you want to cancel? You will need to log in again.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => navigation.navigate('Login'),
        },
      ],
      { type: 'warning' },
    );
  }, [navigation]);

  // Check if code is complete
  const isCodeComplete = code.every(digit => digit !== '');
  const hasErrorMessage = error != null && error.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon
                name='shield-checkmark'
                family='Ionicons'
                size={56}
                color={theme.colors.primary}
              />
            </View>
          </View>

          {/* Title */}
          <Text variant='headline' size='lg' weight='semibold' align='center' style={styles.title}>
            Two-Factor Authentication
          </Text>

          {/* Description */}
          <Text
            variant='body'
            size='md'
            color='secondary'
            align='center'
            style={styles.description}
          >
            Enter the 6-digit code from your authenticator app to complete sign in.
          </Text>

          {/* Error Banner */}
          {hasErrorMessage && (
            <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
              <Text variant='body' size='sm' style={{ color: theme.colors.onErrorContainer }}>
                {error}
              </Text>
            </View>
          )}

          {/* Code Input Fields */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor:
                      focusedIndex === index ? theme.colors.primary : theme.colors.outline,
                    color: theme.colors.onSurface,
                  },
                  focusedIndex === index && styles.codeInputFocused,
                ]}
                value={digit}
                onChangeText={value => handleCodeChange(value, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType='number-pad'
                maxLength={1}
                selectTextOnFocus
                editable={!isLoading}
                testID={`mfa-code-input-${index}`}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {/* Submit Button */}
            <Button
              variant='primary'
              size='lg'
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading || !isCodeComplete}
              style={styles.submitButton}
              testID='mfa-submit-button'
            >
              Verify Code
            </Button>

            {/* Clear Button */}
            <Button
              variant='ghost'
              size='md'
              onPress={handleClear}
              disabled={isLoading || code.every(d => d === '')}
              style={styles.clearButton}
            >
              Clear Code
            </Button>
          </View>

          {/* Help Info */}
          <View style={[styles.helpContainer, { borderTopColor: theme.colors.outlineVariant }]}>
            <Icon
              name='help-circle-outline'
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
                Can&apos;t access your authenticator app?
              </Text>
              <Text variant='body' size='xs' color='secondary' style={styles.helpText}>
                • Make sure your device&apos;s time is set correctly{'\n'}• Use a backup code if you
                have one{'\n'}• Contact support for assistance
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
          </View>

          {/* Back to Login */}
          <Pressable
            style={styles.backToLoginContainer}
            onPress={handleBackToLogin}
            disabled={isLoading}
          >
            <Icon name='arrow-back' family='Ionicons' size={20} color={theme.colors.primary} />
            <Text
              variant='body'
              size='sm'
              color='primary'
              weight='medium'
              style={styles.backToLoginText}
            >
              Back to Login
            </Text>
          </Pressable>
        </Card>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Icon
            name='lock-closed'
            family='Ionicons'
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant='body' size='xs' color='secondary' style={styles.securityText}>
            Two-factor authentication adds an extra layer of security to your account by requiring a
            second form of verification.
          </Text>
        </View>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 32,
    lineHeight: 22,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  codeInputFocused: {
    borderWidth: 2,
  },
  actions: {
    marginBottom: 24,
  },
  submitButton: {
    marginBottom: 8,
  },
  clearButton: {
    marginTop: 4,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 24,
    paddingBottom: 24,
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
  divider: {
    marginBottom: 16,
  },
  dividerLine: {
    height: 1,
  },
  backToLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLoginText: {
    marginLeft: 8,
  },
  securityNotice: {
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
