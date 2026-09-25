/**
 * Security Screen
 * Allows the user to set a new password without entering the old one.
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { View, StyleSheet, ScrollView } from 'react-native';
import * as yup from 'yup';

import type { Translate } from '@/i18n/translate';

import { Text, Button, Card, Input, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { userService } from '@/features/profile/services/userService';
import { passwordHint, passwordRule } from '@/utils/validation/schemas';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

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

// The new password follows the same shared policy as register and reset. This
// screen used to accept 8 characters while reset demanded 12, so one account
// had two password rules depending on which screen the user was on.
const createSchema = (t: Translate) =>
  yup.object({
    currentPassword: yup.string().required(t('validation.currentPasswordRequired', {})),
    newPassword: passwordRule(t),
    confirmPassword: yup
      .string()
      .required(t('validation.confirmPasswordRequired', {}))
      .oneOf([yup.ref('newPassword')], t('validation.passwordsMismatch', {})),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Sign-in providers
// Brand names are not translated. Every non-local provider is listed, so a
// Facebook or Apple user is not told their account is managed by Google.
// ─────────────────────────────────────────────────────────────────────────────

type ExternalProvider = 'google' | 'facebook' | 'apple';

const PROVIDER_DISPLAY: Readonly<Record<ExternalProvider, { name: string; icon: string }>> =
  Object.freeze({
    google: { name: 'Google', icon: 'logo-google' },
    facebook: { name: 'Facebook', icon: 'logo-facebook' },
    apple: { name: 'Apple', icon: 'logo-apple' },
  });

// ─────────────────────────────────────────────────────────────────────────────
// Error parser
// Handles structured backend errors like PASSWORD_REUSE_VIOLATION
// ─────────────────────────────────────────────────────────────────────────────

function parseServerError(error: unknown, fallbackMessage: string): string {
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
  return fallback?.message || fallbackMessage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  // Display only — freshness matters here (a password change on another
  // device should reflect), and useCurrentUser falls back to the restored
  // identity so this is never empty for a signed-in user.
  const { user } = useCurrentUser();
  const provider =
    user?.authProvider !== undefined && user.authProvider !== 'local'
      ? PROVIDER_DISPLAY[user.authProvider]
      : null;
  const isOAuthAccount = provider !== null;
  const schema = useMemo(() => createSchema(t), [t]);
  const unavailablePlaceholder = provider
    ? t('profile.security.notAvailableFor', { provider: provider.name })
    : '';
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
      setServerError(parseServerError(error, t('profile.security.updateFailed')));
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
            {t('profile.security.title')}
          </Text>
          <Text variant='body' size='sm' color='secondary' style={styles.subtitle}>
            {provider
              ? t('profile.security.oauthSubtitle', { provider: provider.name })
              : t('profile.security.subtitle')}
          </Text>

          {provider && (
            <View
              style={[
                styles.oauthInfoBox,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Icon
                name={provider.icon}
                family='Ionicons'
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
              <View style={styles.oauthInfoContent}>
                <Text variant='body' size='sm' weight='medium'>
                  {t('profile.security.oauthSignedIn', { provider: provider.name })}
                </Text>
                <Text
                  variant='body'
                  size='xs'
                  color='secondary'
                  style={styles.oauthInfoDescription}
                >
                  {t('profile.security.oauthDescription', { provider: provider.name })}
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
                  isOAuthAccount ? unavailablePlaceholder : t('profile.security.currentPlaceholder')
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
                label={t('auth.newPassword')}
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setServerError(null);
                }}
                onBlur={onBlur}
                error={errors.newPassword?.message}
                placeholder={
                  isOAuthAccount ? unavailablePlaceholder : t('profile.security.newPlaceholder')
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
                label={t('auth.confirmPassword')}
                value={value}
                onChangeText={text => {
                  onChange(text);
                  setServerError(null);
                }}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
                placeholder={
                  isOAuthAccount ? unavailablePlaceholder : t('profile.security.confirmPlaceholder')
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
                {passwordHint(t)}
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
                color={theme.colors.onErrorContainer}
              />
              <Text
                variant='body'
                size='sm'
                style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
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
              {t('profile.saveChanges')}
            </Button>
          )}

          <Button
            variant='outline'
            size='md'
            onPress={() => navigation.goBack()}
            disabled={isPending}
          >
            {isOAuthAccount ? t('common.goBack') : t('common.cancel')}
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
    padding: sp[5],
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
    gap: sp[3],
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
    padding: sp[3],
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
    padding: sp[3],
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    lineHeight: 20,
  },
  saveButton: {
    marginBottom: sp[3],
  },
});
