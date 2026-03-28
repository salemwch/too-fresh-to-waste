/**
 * Error Message Component
 * Inline error display with icon and retry option
 *
 * Production Standards:
 * - Accessibility
 * - Different severity levels
 * - Dismissible
 * - Retry action
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text, Icon, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorMessageProps {
  message: string;
  severity?: ErrorSeverity;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  testID?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  severity = 'error',
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  testID = 'error-message',
}) => {
  const theme = useTheme();

  const getIconName = () => {
    switch (severity) {
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
    }
  };

  const getBackgroundColor = () => {
    switch (severity) {
      case 'error':
        return theme.colors.errorContainer;
      case 'warning':
        return '#fff3e0'; // Warning container
      case 'info':
        return theme.colors.primaryContainer;
    }
  };

  const getTextColor = () => {
    switch (severity) {
      case 'error':
        return theme.colors.onErrorContainer;
      case 'warning':
        return '#e65100'; // Warning text
      case 'info':
        return theme.colors.onPrimaryContainer;
    }
  };

  const getIconColor = () => {
    switch (severity) {
      case 'error':
        return theme.colors.error;
      case 'warning':
        return '#ff9800'; // Warning
      case 'info':
        return theme.colors.primary;
    }
  };

  return (
    <Card
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
        },
      ]}
      testID={testID}
      accessibilityRole='alert'
      accessibilityLabel={`${severity}: ${message}`}
    >
      <View style={styles.content}>
        <Icon
          name={getIconName()}
          family='Ionicons'
          size={24}
          color={getIconColor()}
          style={styles.icon}
        />
        <Text variant='body' size='md' style={[styles.message, { color: getTextColor() }]}>
          {message}
        </Text>
      </View>

      {(onRetry || onDismiss) && (
        <View style={styles.actions}>
          {onRetry && (
            <Button
              variant='text'
              size='sm'
              onPress={onRetry}
              textStyle={{ color: getTextColor() }}
              accessibilityLabel={retryLabel}
            >
              {retryLabel}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant='text'
              size='sm'
              onPress={onDismiss}
              leftIcon='close'
              leftIconFamily='Ionicons'
              textStyle={{ color: getTextColor() }}
              accessibilityLabel='Dismiss'
            />
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  message: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
});

/**
 * Usage Examples:
 *
 * ```tsx
 * // Error with retry
 * <ErrorMessage
 *   message="Failed to load offers. Please try again."
 *   onRetry={refetch}
 * />
 *
 * // Warning dismissible
 * <ErrorMessage
 *   message="Your session will expire soon"
 *   severity="warning"
 *   onDismiss={() => setWarning(null)}
 * />
 *
 * // Info message
 * <ErrorMessage
 *   message="New version available. Update for new features!"
 *   severity="info"
 * />
 * ```
 */
