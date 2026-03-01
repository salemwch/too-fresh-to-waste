/**
 * Production-Safe Alert Utility
 *
 * Drop-in replacement for React Native's Alert.alert() that automatically
 * adapts to the environment:
 * - Development: Shows native Alert dialogs (for debugging)
 * - Staging: Shows native Alert dialogs (for testing)
 * - Production: Shows non-intrusive Toast notifications
 *
 * Benefits:
 * - Consistent API across all environments
 * - Never blocks production users with alerts
 * - Maintains debugging capability in dev/staging
 * - Centralized alert/notification logic
 *
 * Usage:
 * ```typescript
 * // Replace this:
 * import { Alert } from 'react-native';
 * Alert.alert('Title', 'Message');
 *
 * // With this:
 * import { showAlert } from '@/utils/alert';
 * showAlert('Title', 'Message');
 * ```
 *
 * @see https://reactnative.dev/docs/alert
 * @see apps/mobile/src/utils/toast.tsx
 */

import { Alert } from 'react-native';

import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';
import { showErrorToast, showSuccessToast, showInfoToast } from '@/utils/toast';

// ============================================================================
// Types
// ============================================================================

/**
 * Alert button configuration
 * Matches React Native Alert.AlertButton interface
 */
export interface AlertButton {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Alert type for determining Toast style in production
 */
export type AlertType = 'success' | 'error' | 'info' | 'warning';

/**
 * Alert options for customizing behavior
 */
export interface AlertOptions {
  /** Alert type (determines Toast style in production) */
  type?: AlertType;

  /** Whether alert is cancelable (Android only, ignored in production) */
  cancelable?: boolean;

  /** Callback when alert is dismissed (Android only, ignored in production) */
  onDismiss?: () => void;

  /** Duration for Toast in production (ms, default: 4000) */
  duration?: number;
}

// ============================================================================
// Main Alert Function
// ============================================================================

/**
 * Show alert with environment-aware behavior
 *
 * @param title - Alert title
 * @param message - Alert message (optional)
 * @param buttons - Alert buttons (optional, max 3 for Alert.alert)
 * @param options - Additional options
 *
 * @example
 * ```typescript
 * // Simple alert
 * showAlert('Success', 'Your profile was updated');
 *
 * // Alert with type (affects Toast color in production)
 * showAlert('Error', 'Failed to save', undefined, { type: 'error' });
 *
 * // Alert with buttons (only first button works in production)
 * showAlert('Confirm', 'Delete this item?', [
 *   { text: 'Cancel', style: 'cancel' },
 *   { text: 'Delete', style: 'destructive', onPress: handleDelete }
 * ]);
 * ```
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  const { type = 'info', cancelable, onDismiss, duration = 4000 } = options ?? {};

  // ──────────────────────────────────────────────────────────────────────────
  // DEVELOPMENT / STAGING: Show native Alert dialog
  // ──────────────────────────────────────────────────────────────────────────
  if (!environment.isProduction) {
    const alertButtons = buttons?.map(btn => ({
      text: btn.text ?? 'OK',
      onPress: btn.onPress,
      style: btn.style,
    })) ?? [{ text: 'OK', style: 'default' as const }];

    Logger.debug('[Alert] Showing native alert', { title, message, type });

    Alert.alert(title, message, alertButtons, {
      cancelable: cancelable ?? true,
      onDismiss,
    });

    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCTION: Show non-intrusive Toast
  // ──────────────────────────────────────────────────────────────────────────

  Logger.info('[Alert] Showing production toast', { title, message, type });

  // Combine title and message for Toast
  const toastMessage = title;
  const toastDescription = message;

  // Show Toast based on type
  switch (type) {
    case 'success':
      showSuccessToast(toastMessage, toastDescription, duration);
      break;

    case 'error':
      showErrorToast(toastMessage, toastDescription);
      break;

    case 'warning':
      // Use error style for warnings (no separate warning style)
      showErrorToast(toastMessage, toastDescription);
      break;

    case 'info':
    default:
      showInfoToast(toastMessage, toastDescription);
      break;
  }

  // Execute primary button action if provided
  // In production, we auto-execute the first non-cancel button
  if (buttons && buttons.length > 0) {
    const primaryButton = buttons.find(btn => btn.style !== 'cancel') ?? buttons[0];

    // Execute onPress after a short delay (simulates user dismissing Toast)
    if (primaryButton?.onPress) {
      setTimeout(() => {
        try {
          primaryButton.onPress?.();
        } catch (error) {
          Logger.error('[Alert] Error executing button callback', {}, error as Error);
        }
      }, duration);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Show success alert
 *
 * @example
 * ```typescript
 * showSuccessAlert('Profile Updated', 'Your changes have been saved');
 * ```
 */
export function showSuccessAlert(title: string, message?: string, duration?: number): void {
  showAlert(title, message, undefined, { type: 'success', ...(duration !== undefined && { duration }) });
}

/**
 * Show error alert
 *
 * @example
 * ```typescript
 * showErrorAlert('Failed to Save', 'Please try again later');
 * ```
 */
export function showErrorAlert(title: string, message?: string, duration?: number): void {
  showAlert(title, message, undefined, { type: 'error', ...(duration !== undefined && { duration }) });
}

/**
 * Show info alert
 *
 * @example
 * ```typescript
 * showInfoAlert('Tip', 'You can swipe to delete items');
 * ```
 */
export function showInfoAlert(title: string, message?: string, duration?: number): void {
  showAlert(title, message, undefined, { type: 'info', ...(duration !== undefined && { duration }) });
}

/**
 * Show warning alert
 *
 * @example
 * ```typescript
 * showWarningAlert('Unsaved Changes', 'Your changes will be lost');
 * ```
 */
export function showWarningAlert(title: string, message?: string, duration?: number): void {
  showAlert(title, message, undefined, { type: 'warning', ...(duration !== undefined && { duration }) });
}

/**
 * Show confirmation alert (two buttons: Cancel + Confirm)
 *
 * @param title - Alert title
 * @param message - Alert message
 * @param onConfirm - Callback when user confirms
 * @param onCancel - Callback when user cancels (optional)
 * @param confirmText - Confirm button text (default: 'Confirm')
 * @param cancelText - Cancel button text (default: 'Cancel')
 *
 * @example
 * ```typescript
 * showConfirmAlert(
 *   'Delete Item',
 *   'This action cannot be undone',
 *   () => deleteItem(),
 *   () => console.log('Cancelled')
 * );
 * ```
 *
 * @note In production, confirmation alerts are tricky because Toast auto-dismisses.
 * Consider using a modal for important confirmations instead of this utility.
 */
export function showConfirmAlert(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void | Promise<void>,
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel',
): void {
  if (!environment.isProduction) {
    // Development/Staging: Show native confirmation dialog
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelText,
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText,
          style: 'destructive',
          onPress: onConfirm,
        },
      ],
      { cancelable: true },
    );
  } else {
    // Production: Show Toast with warning (not ideal for confirmations)
    Logger.warn('[Alert] Confirmation alert shown in production - consider using a modal instead', {
      title,
      message,
    });

    showWarningAlert(
      title,
      message || 'Please confirm this action',
      3000, // Shorter duration for confirmations
    );

    // Auto-execute onConfirm after Toast duration (not ideal, but best we can do)
    setTimeout(() => {
      try {
        onConfirm();
      } catch (error) {
        Logger.error('[Alert] Error executing confirm callback', {}, error as Error);
      }
    }, 3000);
  }
}

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * Determine appropriate AlertType from alert context
 * Helps migration from Alert.alert() to showAlert()
 *
 * @param title - Alert title
 * @param message - Alert message
 * @returns Suggested AlertType
 *
 * @example
 * ```typescript
 * const type = getAlertTypeFromContext('Error', 'Failed to load');
 * // Returns: 'error'
 * ```
 */
export function getAlertTypeFromContext(title: string, message?: string): AlertType {
  const lowerTitle = title.toLowerCase();
  const lowerMessage = message?.toLowerCase() ?? '';

  // Error indicators
  if (
    lowerTitle.includes('error') ||
    lowerTitle.includes('failed') ||
    lowerTitle.includes('invalid') ||
    lowerMessage.includes('error') ||
    lowerMessage.includes('failed')
  ) {
    return 'error';
  }

  // Success indicators
  if (
    lowerTitle.includes('success') ||
    lowerTitle.includes('complete') ||
    lowerTitle.includes('verified') ||
    lowerTitle.includes('saved') ||
    lowerMessage.includes('success')
  ) {
    return 'success';
  }

  // Warning indicators
  if (
    lowerTitle.includes('warning') ||
    lowerTitle.includes('caution') ||
    lowerTitle.includes('unsaved') ||
    lowerMessage.includes('warning')
  ) {
    return 'warning';
  }

  // Default to info
  return 'info';
}

// ============================================================================
// Export
// ============================================================================

export default showAlert;
