import crashlytics from '@react-native-firebase/crashlytics';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log error
    Logger.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Report to Crashlytics if enabled
    if (environment.monitoring.enableCrashlytics) {
      void crashlytics().recordError(error);
      void crashlytics().setAttributes({
        componentStack: errorInfo.componentStack ?? 'Unknown',
      });
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Show alert in development
    if (__DEV__) {
      Alert.alert('Error Boundary', `An error occurred: ${error.message}`, [
        { text: 'OK', style: 'cancel' },
        { text: 'Reload', onPress: this.handleReload },
      ]);
    }
  }

  public override componentDidUpdate(prevProps: Props): void {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if resetKeys have changed
    if (hasError && resetOnPropsChange && resetKeys) {
      const prevResetKeys = prevProps.resetKeys ?? [];
      const hasResetKeyChanged = resetKeys.some((key, index) => key !== prevResetKeys[index]);

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  public override componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private readonly resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private readonly handleReload = (): void => {
    // Reset after a small delay to ensure component unmounts properly
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  private readonly handleReportError = (): void => {
    const { error, errorInfo } = this.state;

    if (error && errorInfo) {
      Alert.alert(
        'Report Error',
        'Would you like to report this error to help us improve the app?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              // Here you would implement your error reporting mechanism
              Logger.info('User chose to report error');
              Alert.alert('Thank you', 'Error report sent successfully!');
            },
          },
        ],
      );
    }
  };

  public override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>{error?.message || 'An unexpected error occurred'}</Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={this.handleReload}>
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>

              {!environment.isProduction && (
                <TouchableOpacity
                  style={[styles.button, styles.reportButton]}
                  onPress={this.handleReportError}
                >
                  <Text style={styles.buttonText}>Report Error</Text>
                </TouchableOpacity>
              )}
            </View>

            {__DEV__ && error?.stack && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{error.stack}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 100,
  },
  reportButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
});

// Higher-order component wrapper
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
): React.FC<P> => {
  const WrappedComponent: React.FC<P> = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};
