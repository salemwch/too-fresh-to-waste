/**
 * Error Screen Component
 * Full-screen error display with illustration
 *
 * Production Standards:
 * - User-friendly messaging
 * - Retry action
 * - Navigation options
 * - Accessibility
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text, Button, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

type ErrorType = 'network' | 'notFound' | 'unauthorized' | 'serverError' | 'unknown';

interface ErrorScreenProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  onGoHome?: () => void;
  retryLabel?: string;
  testID?: string;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  type = 'unknown',
  title,
  message,
  onRetry,
  onGoBack,
  onGoHome,
  retryLabel = 'Try Again',
  testID = 'error-screen',
}) => {
  const theme = useTheme();

  const getDefaultContent = () => {
    switch (type) {
      case 'network':
        return {
          emoji: '📡',
          title: 'No Internet Connection',
          message: 'Please check your internet connection and try again.',
        };
      case 'notFound':
        return {
          emoji: '🔍',
          title: 'Not Found',
          message: "We couldn't find what you're looking for.",
        };
      case 'unauthorized':
        return {
          emoji: '🔒',
          title: 'Access Denied',
          message: "You don't have permission to access this content.",
        };
      case 'serverError':
        return {
          emoji: '⚠️',
          title: 'Server Error',
          message: 'Something went wrong on our end. Please try again later.',
        };
      default:
        return {
          emoji: '😕',
          title: 'Something Went Wrong',
          message: 'An unexpected error occurred. Please try again.',
        };
    }
  };

  const defaultContent = getDefaultContent();
  const displayTitle = title || defaultContent.title;
  const displayMessage = message || defaultContent.message;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID={testID}
      accessibilityRole='alert'
    >
      <Card style={styles.card}>
        <View style={styles.content}>
          {/* Emoji Illustration */}
          <Text variant='display' size='xl' style={styles.emoji}>
            {defaultContent.emoji}
          </Text>

          {/* Title */}
          <Text
            variant='headline'
            size='lg'
            weight='bold'
            align='center'
            style={styles.title}
            accessibilityRole='header'
          >
            {displayTitle}
          </Text>

          {/* Message */}
          <Text variant='body' size='md' color='secondary' align='center' style={styles.message}>
            {displayMessage}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {onRetry && (
              <Button
                variant='primary'
                size='lg'
                onPress={onRetry}
                style={styles.button}
                accessibilityLabel={retryLabel}
                testID={`${testID}-retry-button`}
              >
                {retryLabel}
              </Button>
            )}

            {onGoBack && (
              <Button
                variant='outline'
                size='md'
                onPress={onGoBack}
                style={styles.button}
                leftIcon='arrow-back'
                leftIconFamily='Ionicons'
                accessibilityLabel='Go back'
                testID={`${testID}-back-button`}
              >
                Go Back
              </Button>
            )}

            {onGoHome && (
              <Button
                variant='text'
                size='md'
                onPress={onGoHome}
                leftIcon='home'
                leftIconFamily='Ionicons'
                accessibilityLabel='Go to home'
                testID={`${testID}-home-button`}
              >
                Go to Home
              </Button>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
  },
  content: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    marginBottom: 12,
  },
  message: {
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
  },
});

/**
 * Usage Examples:
 *
 * ```tsx
 * // Network error
 * <ErrorScreen
 *   type="network"
 *   onRetry={refetch}
 * />
 *
 * // 404 error
 * <ErrorScreen
 *   type="notFound"
 *   onGoBack={() => navigation.goBack()}
 *   onGoHome={() => navigation.navigate('Home')}
 * />
 *
 * // Custom error
 * <ErrorScreen
 *   title="Payment Failed"
 *   message="Your payment could not be processed. Please check your payment method."
 *   onRetry={retryPayment}
 * />
 * ```
 */
