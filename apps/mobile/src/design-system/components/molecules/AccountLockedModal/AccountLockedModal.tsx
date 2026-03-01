/**
 * Account Locked Modal
 * Professional modal displayed when user account is temporarily locked due to multiple failed login attempts
 * Features countdown timer, helpful guidance, and password reset option
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';

import { useTheme } from '../../../providers';
import { Button, Text, Icon } from '../../atoms';

interface AccountLockedModalProps {
  visible: boolean;
  blockedUntil: string | Date;
  onDismiss: () => void;
  onPasswordReset?: () => void;
}

export const AccountLockedModal = React.memo<AccountLockedModalProps>(function AccountLockedModal({
  visible,
  blockedUntil,
  onDismiss,
  onPasswordReset,
}) {
  const theme = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  /**
   * Calculate and format time remaining until unlock
   */
  const calculateTimeRemaining = useCallback(() => {
    const unlockTime = typeof blockedUntil === 'string' ? new Date(blockedUntil) : blockedUntil;
    const now = new Date();
    const diffMs = unlockTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      setIsExpired(true);
      setTimeRemaining('Account unlocked');
      return;
    }

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
      setTimeRemaining(
        `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`,
      );
    } else {
      setTimeRemaining(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    }

    setIsExpired(false);
  }, [blockedUntil]);

  /**
   * Update countdown every second
   */
  useEffect(() => {
    if (!visible) return undefined;

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [visible, calculateTimeRemaining]);

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
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name='close' family='Ionicons' size='md' color={theme.colors.onSurfaceVariant} />
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
            {isExpired ? 'Account Unlocked' : 'Account Temporarily Locked'}
          </Text>

          {/* Description */}
          <Text variant='body.medium' color='secondary' align='center' style={styles.description}>
            {isExpired
              ? 'You can now try logging in again.'
              : 'Your account has been temporarily locked due to multiple failed login attempts. This is a security measure to protect your account.'}
          </Text>

          {/* Countdown timer */}
          {!isExpired && (
            <View
              style={[
                styles.timerContainer,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
              ]}
            >
              <Icon name='time-outline' family='Ionicons' size='md' color={theme.colors.primary} />
              <View style={styles.timerTextContainer}>
                <Text variant='label.small' color='secondary'>
                  Unlocks in
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
                What can you do?
              </Text>

              <View style={styles.suggestionItem}>
                <Icon
                  name='checkmark-circle'
                  family='Ionicons'
                  size='sm'
                  color={theme.colors.primary}
                />
                <Text variant='body.small' color='secondary' style={styles.suggestionText}>
                  Wait for the timer to expire and try again
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
                  Make sure you're using the correct password
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
                  Reset your password if you've forgotten it
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
                Reset Password
              </Button>
            )}

            <Button
              variant={isExpired ? 'primary' : 'tertiary'}
              size='md'
              onPress={onDismiss}
              style={styles.okButton}
            >
              {isExpired ? 'Try Again' : 'I Understand'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
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
    marginBottom: 20,
  },
  title: {
    marginBottom: 12,
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
    gap: 12,
  },
  timerTextContainer: {
    flex: 1,
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    marginBottom: 12,
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
    gap: 12,
  },
  resetButton: {
    // Additional styles if needed
  },
  okButton: {
    // Additional styles if needed
  },
});
