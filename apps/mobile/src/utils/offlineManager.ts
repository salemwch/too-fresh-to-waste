/**
 * Offline State Manager
 *
 * OFFLINE-FIRST ARCHITECTURE
 * Manages network connectivity state and provides graceful degradation
 *
 * Facebook/Instagram Pattern:
 * - Never kick users out for network errors
 * - Show subtle "No internet" indicator
 * - Load cached data immediately (optimistic UI)
 * - Retry silently in background
 * - User doesn't notice network issues
 *
 * @example
 * ```typescript
 * // Check if we should skip network call
 * if (offlineManager.isOffline()) {
 *   // Load from cache instead
 *   return getCachedData();
 * }
 *
 * // Show offline indicator
 * if (offlineManager.isOffline()) {
 *   showOfflineToast();
 * }
 * ```
 */

import NetInfo from '@react-native-community/netinfo';
import { Logger } from './logger';
import { SafeAnalytics } from './safeAnalytics';
import Toast from 'react-native-toast-message';

/**
 * Offline Manager State
 */
interface OfflineManagerState {
  /** Whether device is currently offline */
  isOffline: boolean;
  /** Last time connectivity was checked */
  lastCheckTime: number;
  /** NetInfo unsubscribe function */
  unsubscribe: (() => void) | null;
  /** Whether offline toast is currently visible */
  toastVisible: boolean;
  /** Last time offline toast was shown (rate limiting) */
  lastToastTime: number;
}

const state: OfflineManagerState = {
  isOffline: false,
  lastCheckTime: 0,
  unsubscribe: null,
  toastVisible: false,
  lastToastTime: 0,
};

/**
 * Configuration
 */
const CONFIG = {
  /** Minimum time between offline toasts (5 seconds) */
  TOAST_RATE_LIMIT_MS: 5000,

  /** How long to show offline toast (3 seconds) */
  TOAST_DURATION_MS: 3000,
};

/**
 * Initialize offline manager
 * Sets up NetInfo listener for connectivity changes
 *
 * Call this once in App.tsx on mount
 */
export const initializeOfflineManager = (): void => {
  // Clean up existing listener if any
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }

  // Subscribe to network state updates
  state.unsubscribe = NetInfo.addEventListener(netInfoState => {
    const wasOffline = state.isOffline;
    const isOffline = !netInfoState.isConnected || netInfoState.isInternetReachable === false;

    state.isOffline = isOffline;
    state.lastCheckTime = Date.now();

    // Log connectivity changes
    if (wasOffline !== isOffline) {
      Logger.info('[OFFLINE-MANAGER] Connectivity changed', {
        isOffline,
        type: netInfoState.type,
        isInternetReachable: netInfoState.isInternetReachable,
      });

      SafeAnalytics.track('connectivity_changed', {
        is_offline: isOffline,
        network_type: netInfoState.type,
      });

      // Show toast when going offline
      if (isOffline) {
        showOfflineToastIfNeeded();
      }

      // Show toast when coming back online
      if (!isOffline && wasOffline) {
        showOnlineToast();
      }
    }
  });

  Logger.info('[OFFLINE-MANAGER] Initialized');
};

/**
 * Clean up offline manager
 * Call this when unmounting app (testing/cleanup)
 */
export const cleanupOfflineManager = (): void => {
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
  Logger.info('[OFFLINE-MANAGER] Cleaned up');
};

/**
 * Check if device is currently offline
 *
 * @returns True if offline, false if online
 */
export const isOffline = (): boolean => {
  return state.isOffline;
};

/**
 * Check if device is currently online
 *
 * @returns True if online, false if offline
 */
export const isOnline = (): boolean => {
  return !state.isOffline;
};

/**
 * Show "No internet connection" toast (rate-limited)
 *
 * Rate limiting prevents toast spam when multiple network calls fail simultaneously
 */
export const showOfflineToastIfNeeded = (): void => {
  const now = Date.now();

  // Rate limit: Don't show toast if one was shown recently
  if (state.toastVisible || now - state.lastToastTime < CONFIG.TOAST_RATE_LIMIT_MS) {
    return;
  }

  state.toastVisible = true;
  state.lastToastTime = now;

  Toast.show({
    type: 'warning',
    text1: 'No internet connection',
    text2: 'Some features may be limited',
    position: 'bottom',
    visibilityTime: CONFIG.TOAST_DURATION_MS,
    onHide: () => {
      state.toastVisible = false;
    },
  });

  Logger.debug('[OFFLINE-MANAGER] Offline toast shown');
};

/**
 * Show "Back online" toast
 */
const showOnlineToast = (): void => {
  Toast.show({
    type: 'success',
    text1: 'Back online',
    text2: 'Connection restored',
    position: 'bottom',
    visibilityTime: 2000,
  });

  Logger.debug('[OFFLINE-MANAGER] Online toast shown');
};

/**
 * Get current connectivity state
 *
 * @returns Current offline manager state
 */
export const getOfflineState = (): Readonly<OfflineManagerState> => ({
  ...state,
});

// Export singleton instance
export const offlineManager = {
  initialize: initializeOfflineManager,
  cleanup: cleanupOfflineManager,
  isOffline,
  isOnline,
  showOfflineToast: showOfflineToastIfNeeded,
  getState: getOfflineState,
};
