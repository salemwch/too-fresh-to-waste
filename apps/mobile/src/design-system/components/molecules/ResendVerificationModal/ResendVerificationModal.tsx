/**
 * Resend Verification Modal
 * Simple modal for users to request a new email verification link
 * Handles expired verification token scenario
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { Button, Input, Text, Card, Icon, EnteringView } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { createEmailSchema, type EmailFormData } from '@/utils/validation/schemas';

const { base: sp } = spacingTokens;

interface ResendVerificationModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (email: string) => void;
  onSendVerification: (email: string) => Promise<void>;
}

export const ResendVerificationModal = memo<ResendVerificationModalProps>(
  ({ visible, onDismiss, onSuccess, onSendVerification }) => {
    const { t } = useTranslation();
    const emailSchema = useMemo(() => createEmailSchema(t), [t]);
    const theme = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // React Hook Form setup
    const {
      control,
      handleSubmit,
      formState: { errors: formErrors },
      reset,
    } = useForm<EmailFormData>({
      resolver: yupResolver(emailSchema),
      mode: 'onBlur',
      defaultValues: {
        email: '',
      },
    });

    /**
     * Handle form submission
     */
    const onSubmit = useCallback(
      async (formData: EmailFormData) => {
        try {
          setIsLoading(true);
          setErrorMessage(null);

          await onSendVerification(formData.email);

          // Reset form and call success callback
          reset();
          onSuccess(formData.email);
        } catch (error: unknown) {
          // A backend sentence is already user-facing and is shown as sent;
          // anything else gets the translated fallback.
          const message =
            error instanceof Error && error.message !== ''
              ? error.message
              : t('verifyEmail.failedToResend');
          setErrorMessage(message);
        } finally {
          setIsLoading(false);
        }
      },
      [onSendVerification, onSuccess, reset, t],
    );

    /**
     * Handle modal dismiss
     */
    const handleDismiss = useCallback(() => {
      if (!isLoading) {
        reset();
        setErrorMessage(null);
        onDismiss();
      }
    }, [isLoading, reset, onDismiss]);

    if (!visible) {
      return null;
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType='fade'
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            accessibilityRole='button'
            style={styles.backdrop}
            onPress={handleDismiss}
            disabled={isLoading}
          />

          <EnteringView animation='fadeIn' duration={200} style={styles.modalContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps='handled'
              showsVerticalScrollIndicator={false}
            >
              <Card style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerContent}>
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: theme.colors.primaryContainer,
                        },
                      ]}
                    >
                      <Icon
                        name='mail-outline'
                        family='Ionicons'
                        size={28}
                        color={theme.colors.primary}
                      />
                    </View>
                    <Text variant='headline.medium' weight='semibold' style={styles.title}>
                      {t('verifyEmail.title')}
                    </Text>
                    <Text
                      variant='body.medium'
                      color='secondary'
                      align='center'
                      style={styles.description}
                    >
                      {t('auth.resend.description')}
                    </Text>
                  </View>

                  {/* Close Button */}
                  <Pressable
                    accessibilityRole='button'
                    accessibilityLabel={t('common.close')}
                    accessibilityHint={t('common.a11yCloseModalHint')}
                    style={styles.closeButton}
                    onPress={handleDismiss}
                    disabled={isLoading}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name='close' family='Ionicons' size={24} color={theme.colors.onSurface} />
                  </Pressable>
                </View>

                {/* Error Message */}
                {errorMessage && (
                  <View
                    style={[
                      styles.errorBanner,
                      {
                        backgroundColor: theme.colors.errorContainer,
                        borderColor: theme.colors.error,
                      },
                    ]}
                  >
                    <Icon
                      name='alert-circle-outline'
                      family='Ionicons'
                      size='md'
                      color={theme.colors.onErrorContainer}
                    />
                    <Text
                      variant='body.small'
                      style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
                    >
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {/* Email Input */}
                <Controller
                  control={control}
                  name='email'
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label={t('auth.emailAddress')}
                      placeholder={t('auth.enterYourEmail')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType='email-address'
                      autoCapitalize='none'
                      autoCorrect={false}
                      autoComplete='email'
                      leftIcon={<Icon name='mail-outline' family='Ionicons' size='md' />}
                      hasError={!!formErrors.email}
                      errorText={formErrors.email?.message}
                      editable={!isLoading}
                      fullWidth
                    />
                  )}
                />

                {/* Send Button */}
                <Button
                  variant='primary'
                  size='lg'
                  onPress={() => {
                    void handleSubmit(onSubmit)();
                  }}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.sendButton}
                >
                  {t('auth.resend.send')}
                </Button>

                {/* Cancel Button */}
                <Button
                  variant='outline'
                  size='md'
                  onPress={handleDismiss}
                  disabled={isLoading}
                  style={styles.cancelButton}
                >
                  {t('common.cancel')}
                </Button>

                {/* Help Text */}
                <View style={styles.helpContainer}>
                  <Icon
                    name='information-circle-outline'
                    family='Ionicons'
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant='body.small' color='secondary' style={styles.helpText}>
                    {t('auth.resend.help')}
                  </Text>
                </View>
              </Card>
            </ScrollView>
          </EnteringView>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

ResendVerificationModal.displayName = 'ResendVerificationModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp[5],
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 450,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    insetInlineEnd: 0,
    padding: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: sp[3],
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
  },
  sendButton: {
    marginTop: 8,
    marginBottom: sp[3],
  },
  cancelButton: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  helpText: {
    flex: 1,
    lineHeight: 18,
  },
});
