/**
 * Account Locked Modal
 * Professional modal displayed when user account is temporarily locked due to multiple failed login attempts
 * Features countdown timer, helpful guidance, and password reset option
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Modal, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Button, Text, Icon } from '../../atoms';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

interface AccountLockedModalProps {
  visible: boolean;
  blockedUntil: string | Date;
  onDismiss: () => void;
  onPasswordReset?: () => void;
}

/**
 * Numbers only - the words (and their plural forms, which Arabic has six of)
 * come from the translations. An unparseable date counts as unlocked rather
 * than rendering "NaN minutes"; the backend still enforces the real lock.
 */
const getLockState = (blockedUntil: string | Date, currentTime: number) => {
  const unlockTime = typeof blockedUntil === 'string' ? new Date(blockedUntil) : blockedUntil;
  const diffMs = unlockTime.getTime() - currentTime;

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { isExpired: true, minutes: 0, seconds: 0 };
  }

  return {
    isExpired: false,
    minutes: Math.floor(diffMs / 60000),
    seconds: Math.floor((diffMs % 60000) / 1000),
  };
};

export const AccountLockedModal = memo<AccountLockedModalProps>(
  ({ visible, blockedUntil, onDismiss, onPasswordReset }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const { isExpired, minutes, seconds } = useMemo(
      () => getLockState(blockedUntil, currentTime),
      [blockedUntil, currentTime],
    );
    const timeRemaining =
      minutes > 0
        ? t('auth.locked.minutesSeconds', { minutes, seconds })
        : t('auth.locked.seconds', { count: seconds });

    /**
     * Update countdown every second
     */
    useEffect(() => {
      if (!visible) return undefined;

      const refreshCurrentTime = () => {
        setCurrentTime(Date.now());
      };
      const timeout = setTimeout(refreshCurrentTime, 0);
      const interval = setInterval(refreshCurrentTime, 1000);

      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }, [visible, blockedUntil]);

    /**
     * Auto-dismiss when unlocked
     */
    useEffect(() => {
      if (isExpired && visible) {
        // Wait 1 second after expiry to show "Account unlocked" message
        const timeout = setTimeout(() => {
          onDismiss();
        }, 1000);

        return () => clearTimeout(timeout);
      }
      return undefined;
    }, [isExpired, visible, onDismiss]);

    const handlePasswordReset = () => {
      onDismiss();
      onPasswordReset?.();
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType='fade'
        onRequestClose={onDismiss}
        statusBarTranslucent
      >
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay.dark }]}>
          <View
            testID='account-locked-modal'
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.colors.surface,
                shadowColor: theme.colors.onSurface,
              },
            ]}
          >
            {/* Close button */}
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={t('common.close')}
              accessibilityHint={t('common.a11yCloseModalHint')}
              style={styles.closeButton}
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name='close'
                family='Ionicons'
                size='md'
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>

            {/* Lock icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isExpired
                    ? theme.colors.successContainer
                    : theme.colors.errorContainer,
                },
              ]}
            >
              <Icon
                name={isExpired ? 'lock-open-outline' : 'lock-closed-outline'}
                family='Ionicons'
                size='xl'
                color={isExpired ? theme.colors.success : theme.colors.error}
              />
            </View>

            {/* Title */}
            <Text variant='headline.medium' weight='semibold' align='center' style={styles.title}>
              {isExpired ? t('auth.locked.titleUnlocked') : t('auth.locked.titleLocked')}
            </Text>

            {/* Description */}
            <Text variant='body.medium' color='secondary' align='center' style={styles.description}>
              {isExpired ? t('auth.locked.bodyUnlocked') : t('auth.locked.bodyLocked')}
            </Text>

            {/* Countdown timer */}
            {!isExpired && (
              <View
                style={[
                  styles.timerContainer,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Icon
                  name='time-outline'
                  family='Ionicons'
                  size='md'
                  color={theme.colors.primary}
                />
                <View style={styles.timerTextContainer}>
                  <Text variant='label.small' color='secondary'>
                    {t('auth.locked.unlocksIn')}
                  </Text>
                  <Text variant='body.large' weight='semibold' color='primary'>
                    {timeRemaining}
                  </Text>
                </View>
              </View>
            )}

            {/* Helpful suggestions */}
            {!isExpired && (
              <View style={styles.suggestionsContainer}>
                <Text variant='label.medium' weight='semibold' style={styles.suggestionsTitle}>
                  {t('auth.locked.whatCanYouDo')}
                </Text>

                <View style={styles.suggestionItem}>
                  <Icon
                    name='checkmark-circle'
                    family='Ionicons'
                    size='sm'
                    color={theme.colors.primary}
                  />
                  <Text variant='body.small' color='secondary' style={styles.suggestionText}>
                    {t('auth.locked.tipWait')}
                  </Text>
                </View>

                <View style={styles.suggestionItem}>
                  <Icon
                    name='checkmark-circle'
                    family='Ionicons'
                    size='sm'
                    color={theme.colors.primary}
                  />
                  <Text variant='body.small' color='secondary' style={styles.suggestionText}>
                    {t('auth.locked.tipPassword')}
                  </Text>
                </View>

                <View style={styles.suggestionItem}>
                  <Icon
                    name='checkmark-circle'
                    family='Ionicons'
                    size='sm'
                    color={theme.colors.primary}
                  />
                  <Text variant='body.small' color='secondary' style={styles.suggestionText}>
                    {t('auth.locked.tipReset')}
                  </Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              {onPasswordReset && !isExpired && (
                <Button
                  variant='outline'
                  size='md'
                  onPress={handlePasswordReset}
                  style={styles.resetButton}
                >
                  {t('auth.locked.resetPassword')}
                </Button>
              )}

              <Button
                variant={isExpired ? 'primary' : 'tertiary'}
                size='md'
                onPress={onDismiss}
                style={styles.okButton}
              >
                {isExpired ? t('auth.locked.tryAgain') : t('auth.locked.understood')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    );
  },
);

AccountLockedModal.displayName = 'AccountLockedModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    insetInlineEnd: 16,
    zIndex: 10,
    padding: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: sp[5],
  },
  title: {
    marginBottom: sp[3],
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: sp[3],
  },
  timerTextContainer: {
    flex: 1,
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    marginBottom: sp[3],
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: sp[3],
  },
  resetButton: {
    // Additional styles if needed
  },
  okButton: {
    // Additional styles if needed
  },
});
