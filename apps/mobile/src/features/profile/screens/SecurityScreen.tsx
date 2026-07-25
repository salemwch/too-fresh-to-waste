/**
 * Security Screen
 * Allows the user to set a new password without entering the old one.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { View, StyleSheet, ScrollView } from 'react-native';
import * as yup from 'yup';

import { Text, Button, Card, Input, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { selectAuthUser } from '@/features/auth/store/authSlice';
import { userService } from '@/features/profile/services/userService';
import { useAppSelector } from '@/hooks';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SecurityScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Security'>;

interface SecurityScreenProps {
  navigation: SecurityScreenNavigationProp;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const schema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Must contain at least one lowercase letter')
    .matches(/\d/, 'Must contain at least one number')
    .matches(/[@$!%*?&.]/, 'Must contain at least one special character (@$!%*?&.)'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords do not match'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Error parser
// Handles structured backend errors like PASSWORD_REUSE_VIOLATION
// ─────────────────────────────────────────────────────────────────────────────

function parseServerError(error: unknown): string {
  const axiosError = error as { response?: { data?: { message?: unknown } } };
  const raw = axiosError?.response?.data?.message;

  // Structured error: { message: string, type: string, ... }
  if (raw !== null && raw !== undefined && typeof raw === 'object') {
    const structured = raw as { message?: string };
    if (typeof structured.message === 'string') return structured.message;
  }

  // Plain string message
  if (typeof raw === 'string') return raw;

  // Fallback
  const fallback = error as Error;
  return fallback?.message ?? 'Unable to update password. Please try again.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAppSelector(selectAuthUser);
  const isOAuthAccount = user?.authProvider !== undefined && user.authProvider !== 'local';
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PasswordFormValues>({
    resolver: yupResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const { mutate: updatePassword, isPending } = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      userService.updatePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      reset();
      navigation.goBack();
    },
    onError: (error: unknown) => {
      setServerError(parseServerError(error));
    },
  });

  const onSubmit = useCallback(
    (values: PasswordFormValues) => {
      setServerError(null);
      updatePassword(values);
    },
    [updatePassword],
  );

  const handleSubmitEditing = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const handleSavePress = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
            Change Password
          </Text>
          <Text variant='body' size='sm' color='secondary' style={styles.subtitle}>
            {isOAuthAccount
              ? 'Your account is managed by Google. Password changes are not available.'
              : 'Set a new password for your account.'}
          </Text>

          {isOAuthAccount && (
            <View
              style={[
                styles.oauthInfoBox,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outline,
                },
              ]}
            >
              <Icon
                name='logo-google'
                family='Ionicons'
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
              <View style={styles.oauthInfoContent}>
                <Text variant='body' size='sm' weight='medium'>
                  Signed in with Google
                </Text>
                <Text
                  variant='body'
                  size='xs'
                  color='secondary'
                  style={styles.oauthInfoDescription}
                >
                  Password is managed by your Google account. To change your password, visit your
                  Google Account settings.
                </Text>
              </View>
            </View>
          )}

          {/* Current Password */}
          <Controller
            control={control}
            name='currentPassword'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.currentPassword')}
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setServerError(null);
                }}
                onBlur={onBlur}
                error={errors.currentPassword?.message}
                placeholder={
                  isOAuthAccount ? 'Not available for Google accounts' : 'Enter current password'
                }
                secureTextEntry={!showCurrent}
                autoCapitalize='none'
                autoCorrect={false}
                returnKeyType='next'
                rightIcon={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily='Ionicons'
                onRightIconPress={() => setShowCurrent(v => !v)}
                disabled={isOAuthAccount}
                style={styles.input}
              />
            )}
          />

          {/* New Password */}
          <Controller
            control={control}
            name='newPassword'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='New Password'
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setServerError(null);
                }}
                onBlur={onBlur}
                error={errors.newPassword?.message}
                placeholder={
                  isOAuthAccount ? 'Not available for Google accounts' : 'Enter new password'
                }
                secureTextEntry={!showNew}
                autoCapitalize='none'
                autoCorrect={false}
                returnKeyType='next'
                rightIcon={showNew ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily='Ionicons'
                onRightIconPress={() => setShowNew(v => !v)}
                disabled={isOAuthAccount}
                style={styles.input}
              />
            )}
          />

          {/* Confirm Password */}
          <Controller
            control={control}
            name='confirmPassword'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='Confirm Password'
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setServerError(null);
                }}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
                placeholder={
                  isOAuthAccount ? 'Not available for Google accounts' : 'Re-enter new password'
                }
                secureTextEntry={!showConfirm}
                autoCapitalize='none'
                autoCorrect={false}
                returnKeyType='done'
                rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                rightIconFamily='Ionicons'
                onRightIconPress={() => setShowConfirm(v => !v)}
                onSubmitEditing={handleSubmitEditing}
                disabled={isOAuthAccount}
                style={styles.input}
              />
            )}
          />

          {/* Password requirements hint — only for local accounts */}
          {!isOAuthAccount && (
            <View style={[styles.hintBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Icon
                name='information-circle-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant='body' size='xs' color='secondary' style={styles.hintText}>
                Min. 8 chars · uppercase · lowercase · number · special char (@$!%*?&.)
              </Text>
            </View>
          )}

          {/* Inline server error — only for local accounts */}
          {!isOAuthAccount && serverError !== null && (
            <View
              style={[
                styles.errorBox,
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
              <Text
                variant='body'
                size='sm'
                style={[styles.errorText, { color: theme.colors.error }]}
              >
                {serverError}
              </Text>
            </View>
          )}

          {/* Actions */}
          {!isOAuthAccount && (
            <Button
              variant='primary'
              size='lg'
              onPress={handleSavePress}
              loading={isPending}
              disabled={!isDirty || isPending}
              style={styles.saveButton}
            >
              Save Changes
            </Button>
          )}

          <Button
            variant='outline'
            size='md'
            onPress={() => navigation.goBack()}
            disabled={isPending}
          >
            {isOAuthAccount ? 'Go Back' : 'Cancel'}
          </Button>
        </Card>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  oauthInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  oauthInfoContent: {
    flex: 1,
  },
  oauthInfoDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  input: {
    marginBottom: 16,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  hintText: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    lineHeight: 20,
  },
  saveButton: {
    marginBottom: 12,
  },
});
