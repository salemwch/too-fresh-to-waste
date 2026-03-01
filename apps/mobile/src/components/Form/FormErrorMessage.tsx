/**
 * Form Error Message Component
 * Display form-level errors
 *
 * Production Standards:
 * - Accessibility
 * - Dismissible
 * - Icon support
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Text, Icon, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

interface FormErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  testID?: string;
}

export const FormErrorMessage: React.FC<FormErrorMessageProps> = ({
  message,
  onDismiss,
  testID = 'form-error-message',
}) => {
  const theme = useTheme();

  if (!message) return null;

  return (
    <Card
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.errorContainer,
          borderLeftColor: theme.colors.error,
        },
      ]}
      testID={testID}
      accessibilityRole='alert'
      accessibilityLabel={`Error: ${message}`}
    >
      <View style={styles.content}>
        <Icon
          name='alert-circle'
          family='Ionicons'
          size={20}
          color={theme.colors.error}
          style={styles.icon}
        />
        <Text
          variant='body'
          size='sm'
          style={[styles.message, { color: theme.colors.onErrorContainer }]}
        >
          {message}
        </Text>
      </View>

      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          style={styles.dismissButton}
          accessibilityRole='button'
          accessibilityLabel='Dismiss error'
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name='close' family='Ionicons' size={20} color={theme.colors.onErrorContainer} />
        </Pressable>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
  },
  dismissButton: {
    marginLeft: 12,
    padding: 4,
  },
});

/**
 * Usage Example:
 *
 * ```tsx
 * const [formError, setFormError] = useState('');
 *
 * <FormErrorMessage
 *   message={formError}
 *   onDismiss={() => setFormError('')}
 * />
 * ```
 */
