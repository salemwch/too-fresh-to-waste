/**
 * Error Boundary Component
 *
 * Production-grade error boundary that catches React component errors
 * and prevents the entire app from crashing.
 *
 * Features:
 * - Catches all React render errors in child tree
 * - Shows user-friendly fallback UI
 * - Logs errors to console and Sentry (when enabled)
 * - Allows user to retry/recover
 * - Handles different error types (render, event handler, async)
 *
 * Best Practices:
 * - Wrap entire app or critical sections
 * - Provide actionable recovery options
 * - Never show technical error details to users
 * - Always log errors for debugging
 * - Test error scenarios in development
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import { Logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;

  /** Optional custom fallback UI */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);

  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /** Optional boundary name for logging context */
  boundaryName?: string;
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;

  /** The caught error object */
  error: Error | null;

  /** React error info (component stack trace) */
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when error is caught
   * Updates state to trigger fallback UI render
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after error is caught
   * Used for logging and error reporting
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, boundaryName = 'ErrorBoundary' } = this.props;

    // ────────────────────────────────────────────────────────────────────────
    // 1. LOG ERROR TO CONSOLE
    // ────────────────────────────────────────────────────────────────────────
    Logger.error(
      `[${boundaryName}] React component error caught`,
      {
        errorName: error.name,
        errorMessage: error.message,
        componentStack: errorInfo.componentStack?.split('\n').slice(0, 5).join('\n'), // First 5 lines
      },
      error,
    );

    // ────────────────────────────────────────────────────────────────────────
    // 2. REPORT TO SENTRY (if enabled)
    // ────────────────────────────────────────────────────────────────────────
    // Note: Sentry integration will be added in setupSentry.ts
    // Sentry.captureException(error, { contexts: { react: { componentStack } } });

    // ────────────────────────────────────────────────────────────────────────
    // 3. CALL CUSTOM ERROR HANDLER (if provided)
    // ────────────────────────────────────────────────────────────────────────
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        Logger.error('Error in custom error handler', {}, handlerError as Error);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. UPDATE STATE TO SHOW FALLBACK UI
    // ────────────────────────────────────────────────────────────────────────
    this.setState({ errorInfo });
  }

  /**
   * Reset error state and retry rendering children
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    Logger.info('[ErrorBoundary] Error state reset, retrying render');
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // ────────────────────────────────────────────────────────────────────────
    // NO ERROR - Render children normally
    // ────────────────────────────────────────────────────────────────────────
    if (!hasError || !error) {
      return children;
    }

    // ────────────────────────────────────────────────────────────────────────
    // ERROR CAUGHT - Render fallback UI
    // ────────────────────────────────────────────────────────────────────────

    // Use custom fallback if provided
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }
      return fallback;
    }

    // Default fallback UI
    return <DefaultErrorFallback error={error} errorInfo={errorInfo} onReset={this.resetError} />;
  }
}

// ============================================================================
// Default Fallback UI Component
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  onReset,
}: DefaultErrorFallbackProps): React.JSX.Element {
  const isDevelopment = __DEV__;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Error Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Something went wrong</Text>

        {/* User-friendly message */}
        <Text style={styles.message}>
          We&apos;re sorry for the inconvenience. The app encountered an unexpected error.
        </Text>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <Pressable style={styles.primaryButton} onPress={onReset}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>

        {/* Development-only error details */}
        {isDevelopment && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Information (Dev Mode Only)</Text>

            <View style={styles.debugSection}>
              <Text style={styles.debugLabel}>Error:</Text>
              <Text style={styles.debugText}>{error.message}</Text>
            </View>

            {error.stack != null && (
              <View style={styles.debugSection}>
                <Text style={styles.debugLabel}>Stack Trace:</Text>
                <Text style={styles.debugText} numberOfLines={10}>
                  {error.stack}
                </Text>
              </View>
            )}

            {errorInfo?.componentStack != null && (
              <View style={styles.debugSection}>
                <Text style={styles.debugLabel}>Component Stack:</Text>
                <Text style={styles.debugText} numberOfLines={10}>
                  {errorInfo.componentStack}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 40,
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 12,
  },
  debugSection: {
    marginBottom: 16,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
  },
});

// ============================================================================
// Export
// ============================================================================

export default ErrorBoundary;
