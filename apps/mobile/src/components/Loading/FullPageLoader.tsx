/**
 * Full Page Loader Component
 * Full-screen loading indicator
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

interface FullPageLoaderProps {
  message?: string;
  testID?: string;
}

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = 'Loading...',
  testID = 'full-page-loader',
}) => {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID={testID}
      accessibilityLabel={message}
      accessibilityRole='progressbar'
    >
      <ActivityIndicator size='large' color={theme.colors.primary} style={styles.spinner} />
      {message && (
        <Text variant='body' size='md' color='secondary' align='center' style={styles.message}>
          {message}
        </Text>
      )}
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
  spinner: {
    marginBottom: 16,
  },
  message: {
    maxWidth: 300,
  },
});

/**
 * Usage:
 *
 * ```tsx
 * // In Suspense fallback
 * <React.Suspense fallback={<FullPageLoader />}>
 *   <LazyScreen />
 * </React.Suspense>
 *
 * // Conditional rendering
 * {isInitializing && <FullPageLoader message="Setting up your account..." />}
 * ```
 */
