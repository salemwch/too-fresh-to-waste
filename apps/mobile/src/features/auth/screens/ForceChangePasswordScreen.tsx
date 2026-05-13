/**
 * ForceChangePasswordScreen
 *
 * Hard-wall screen for admin-created accounts. The user MUST set a new password
 * before the app becomes usable. Android back button is disabled; gesture-back is
 * disabled at the navigator level (gestureEnabled: false in AuthStack).
 *
 * Flow:
 *   1. POST /auth/force-password-change  (JWT-guarded — token already in Keychain)
 *   2. Save fresh access + refresh tokens to Keychain via SecureStorage.setTokens()
 *   3. Dispatch setFlowState(AUTHENTICATED) → RootNavigator routes to MainStack
 */

import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';

import { setFlowState } from '@/features/auth/store/authSlice';
import { AuthFlowState } from '@/features/auth/types';
import { useAppDispatch } from '@/hooks/redux';
import { apiClient, BackendApiResponse } from '@/services/apiClient';
import { SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { Logger } from '@/utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  newPassword: string;
}

interface ForcePasswordChangeResponseData {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    email: string;
    role: string;
    requiresPasswordChange: boolean;
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ForceChangePasswordScreen() {
  const dispatch = useAppDispatch();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  // Disable Android hardware back button — this is a hard wall.
  // The navigator also sets gestureEnabled: false for iOS swipe-back.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const response = await apiClient.post<BackendApiResponse<ForcePasswordChangeResponseData>>(
          '/auth/force-password-change',
          { newPassword: data.newPassword },
        );

        const { accessToken, refreshToken } = response.data.data;

        // CRITICAL: Await token storage — old tokens are revoked on success.
        // If we fire-and-forget and the app crashes before writing, the user
        // is locked out (revoked tokens + nothing in Keychain).
        await SecureStorage.setTokens(accessToken, refreshToken);

        // Non-critical metadata — fire-and-forget is acceptable here.
        backgroundStorage.execute('force-pw-change-metadata', async () => {
          // Use a standard 15-minute access token window as the backend
          // response does not include expiresIn for this endpoint.
          const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
          const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
          await SecureStorage.setSessionMetadata(expiresAt.toISOString(), new Date().toISOString());
        });

        Logger.info('[ForceChangePassword] Password changed — transitioning to AUTHENTICATED');

        // STATE-DRIVEN NAVIGATION: RootNavigator renders MainStack on AUTHENTICATED
        dispatch(setFlowState(AuthFlowState.AUTHENTICATED));
      } catch (error) {
        Logger.error('[ForceChangePassword] Failed to change password', {}, error as Error);
        Alert.alert('Error', 'Failed to change password. Please try again.');
      }
    },
    [dispatch],
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.title}>Set Your Password</Text>
          <Text style={styles.subtitle}>You must set a new password before using the app.</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name='newPassword'
            rules={{
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.newPassword != null && styles.inputError]}
                placeholder='New password (min. 8 characters)'
                placeholderTextColor='#9CA3AF'
                secureTextEntry
                autoCapitalize='none'
                autoCorrect={false}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID='new-password-input'
              />
            )}
          />
          {errors.newPassword != null && (
            <Text style={styles.errorText}>{errors.newPassword.message}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.8}
            testID='submit-button'
          >
            {isSubmitting ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <Text style={styles.buttonText}>Save Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E4448',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  form: {
    gap: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    color: '#111827',
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1E4448',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
