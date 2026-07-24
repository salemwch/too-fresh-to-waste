/**
 * TanStack Query Platform Setup
 * React Native-specific configuration for Online and Focus management
 *
 * Features:
 * - Network state monitoring with NetInfo
 * - App state monitoring with AppState
 * - Automatic refetch on reconnect
 * - Automatic refetch on app focus
 */

import { addEventListener as addNetInfoEventListener } from '@react-native-community/netinfo';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { Logger } from '@/utils/logger';

import type { AppStateStatus } from 'react-native';

/**
 * Setup Online Manager
 * Monitors network connectivity and updates TanStack Query's online status
 *
 * Uses @react-native-community/netinfo to detect:
 * - Network connection state
 * - Connection type (wifi, cellular, etc.)
 * - Internet reachability
 */
const setupOnlineManager = () => {
  Logger.info('Setting up TanStack Query Online Manager');

  onlineManager.setEventListener(setOnline => {
    // Subscribe to network state updates
    const unsubscribe = addNetInfoEventListener(state => {
      // Treat null (undetermined) as online — only pause on definite offline.
      const isOnline = state.isConnected !== false;

      Logger.info('[OnlineManager] NetInfo event', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        resolvedOnline: isOnline,
      });

      setOnline(isOnline);
    });

    // Return cleanup function
    return () => {
      Logger.debug('Cleaning up Online Manager');
      unsubscribe();
    };
  });

  Logger.info('Online Manager setup complete');
};

/**
 * Setup Focus Manager
 * Monitors app foreground/background state and updates TanStack Query's focus status
 *
 * Uses React Native's AppState to detect:
 * - App becomes active (foreground)
 * - App becomes inactive
 * - App goes to background
 */
const setupFocusManager = () => {
  Logger.info('Setting up TanStack Query Focus Manager');

  /**
   * Handle app state change
   * Updates focus manager when app state changes
   */
  const onAppStateChange = (status: AppStateStatus) => {
    // Only track focus on native platforms (not web)
    if (Platform.OS !== 'web') {
      const isFocused = status === 'active';

      Logger.debug('App state changed', {
        status,
        isFocused,
      });

      // Update TanStack Query's focus status
      focusManager.setFocused(isFocused);
    }
  };

  // Subscribe to app state changes
  const subscription = AppState.addEventListener('change', onAppStateChange);

  Logger.info('Focus Manager setup complete');

  // Return cleanup function
  return () => {
    Logger.debug('Cleaning up Focus Manager');
    subscription.remove();
  };
};

/**
 * Initialize all platform-specific managers
 * Should be called once during app initialization
 */
export const initializePlatformManagers = () => {
  Logger.info('Initializing TanStack Query platform managers');

  setupOnlineManager();
  const cleanupFocusManager = setupFocusManager();

  Logger.info('Platform managers initialized successfully');

  // Return cleanup function for all managers
  return () => {
    cleanupFocusManager();
  };
};

/**
 * Platform Setup Summary:
 *
 * Online Manager:
 * - Monitors network connectivity via NetInfo
 * - Automatically pauses queries when offline
 * - Automatically resumes queries when online
 * - Triggers refetch on reconnect (if enabled in query options)
 *
 * Focus Manager:
 * - Monitors app foreground/background state
 * - Automatically refetches stale queries when app becomes active
 * - Prevents unnecessary refetches when app is in background
 * - Only active on native platforms (not web)
 *
 * Benefits for Mobile:
 * - Reduces unnecessary network requests when offline
 * - Keeps data fresh when app regains focus
 * - Improves battery life by reducing background activity
 * - Better user experience with automatic data updates
 */
