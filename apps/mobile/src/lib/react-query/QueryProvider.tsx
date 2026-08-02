/**
 * TanStack Query Provider
 * Wraps the app with QueryClientProvider and error boundaries
 *
 * Features:
 * - Query client provider
 * - Error boundary for query errors
 * - Platform managers initialization
 * - DevTools integration (development only)
 * - Persister setup (optional)
 */

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import React, { useEffect, Component } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { queryPersister, shouldPersistQuery, PERSIST_MAX_AGE, PERSIST_BUSTER } from './persister';
import { initializePlatformManagers } from './platformSetup';
import { queryClient } from './queryClient';

import type { ErrorInfo, ReactNode } from 'react';
import { colorTokens } from '@/design-system/tokens/colors';

const ERROR_BACKGROUND = '#f9f9f9';
const ERROR_TITLE = colorTokens.base.error[500];
const ERROR_MESSAGE = '#666';
const RETRY_BUTTON = '#1976d2';
const RETRY_LABEL = '#fff';

/**
 * Props for Error Boundary
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

/**
 * State for Error Boundary
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches errors in the query tree
 */
class QueryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Logger.error('Query Error Boundary caught error', { errorInfo }, error);
    void ErrorHandler.handle(error, {
      context: 'QueryErrorBoundary',
      componentStack: errorInfo.componentStack,
    });
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  override render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 * Displayed when query errors occur
 */
const DefaultErrorFallback: React.FC<{
  error: Error;
  resetError: () => void;
}> = ({ resetError }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{t('common.somethingWentWrong')}</Text>
      <Text style={styles.errorMessage}>{t('errors.queryBoundaryMessage')}</Text>
      <Pressable accessibilityRole='button' style={styles.retryButton} onPress={resetError}>
        <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
      </Pressable>
    </View>
  );
};

/**
 * Props for Query Provider
 */
interface QueryProviderProps {
  children: ReactNode;
  errorBoundary?: boolean;
  errorFallback?: (error: Error, resetError: () => void) => ReactNode;
}

/**
 * Query Provider Component
 * Main provider that wraps the app
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({
  children,
  errorBoundary = true,
  errorFallback,
}) => {
  /**
   * Initialize platform managers on mount
   */
  useEffect(() => {
    Logger.info('Initializing TanStack Query Provider');

    // Initialize platform-specific managers
    const cleanup = initializePlatformManagers();

    Logger.info('TanStack Query Provider initialized');

    // Cleanup on unmount
    return () => {
      Logger.info('Cleaning up TanStack Query Provider');
      cleanup();
    };
  }, []);

  // PersistQueryClientProvider, not QueryClientProvider: it restores the cached
  // catalogue from MMKV before the first render, so a cold start shows the last
  // known offers immediately instead of an empty screen waiting on the network.
  // See persister.ts for what is (and is not) allowed onto disk.
  const content = (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
      {/* DevTools will be added here in development mode */}
    </PersistQueryClientProvider>
  );

  // Wrap with error boundary if enabled
  if (errorBoundary) {
    // Conditional spreading for exactOptionalPropertyTypes compliance
    return (
      <QueryErrorBoundary {...(errorFallback && { fallback: errorFallback })}>
        {content}
      </QueryErrorBoundary>
    );
  }

  return content;
};

/**
 * Hook to access query client
 * Convenience hook for accessing the query client instance
 */
/**
 * Styles for error fallback
 */
const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: ERROR_BACKGROUND,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ERROR_TITLE,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: ERROR_MESSAGE,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: RETRY_BUTTON,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: RETRY_LABEL,
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * Query Provider Summary:
 *
 * Features:
 * - Wraps app with QueryClientProvider
 * - Initializes platform managers (online, focus)
 * - Error boundary for graceful error handling
 * - Customizable error fallback UI
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```tsx
 * import { QueryProvider } from '@/lib/react-query';
 *
 * function App() {
 *   return (
 *     <QueryProvider>
 *       <YourApp />
 *     </QueryProvider>
 *   );
 * }
 * ```
 *
 * With custom error fallback:
 * ```tsx
 * <QueryProvider
 *   errorFallback={(error, reset) => (
 *     <CustomErrorScreen error={error} onRetry={reset} />
 *   )}
 * >
 *   <YourApp />
 * </QueryProvider>
 * ```
 */
