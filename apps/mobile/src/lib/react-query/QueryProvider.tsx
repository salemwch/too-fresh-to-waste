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

import { QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useState, Component } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { initializePlatformManagers } from './platformSetup';
import { queryClient } from './queryClient';

import type { ErrorInfo, ReactNode } from 'react';

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
    ErrorHandler.handle(error, {
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
}> = ({ error, resetError }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>{error.message}</Text>
    <Pressable style={styles.retryButton} onPress={resetError}>
      <Text style={styles.retryButtonText}>Try Again</Text>
    </Pressable>
  </View>
);

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
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize platform managers on mount
   */
  useEffect(() => {
    Logger.info('Initializing TanStack Query Provider');

    // Initialize platform-specific managers
    const cleanup = initializePlatformManagers();

    setIsInitialized(true);

    Logger.info('TanStack Query Provider initialized');

    // Cleanup on unmount
    return () => {
      Logger.info('Cleaning up TanStack Query Provider');
      cleanup();
    };
  }, []);

  // Show loading state while initializing
  if (!isInitialized) {
    return null; // or a loading spinner
  }

  const content = (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools will be added here in development mode */}
    </QueryClientProvider>
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
;

/**
 * Styles for error fallback
 */
const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
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
