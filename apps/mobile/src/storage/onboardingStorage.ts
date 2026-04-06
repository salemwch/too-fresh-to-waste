/**
 * Onboarding Storage Service
 * Device-level flag to track whether user has seen the welcome screen
 *
 * CRITICAL REQUIREMENTS:
 * - Synchronous reads (no await/Promise) to avoid startup flicker
 * - Device-level persistence (survives login/logout)
 * - Only cleared on app reinstall or manual storage clear
 *
 * Used by RootNavigator to decide initial route without async delay.
 */

import { Logger } from '@/utils/logger';

import { mmkvStorage } from './mmkv';

/**
 * Storage key for welcome screen flag
 */
const KEY_HAS_SEEN_WELCOME = 'hasSeenWelcome';

/**
 * Onboarding storage API
 * All methods are synchronous for instant app startup
 */
export const onboardingStorage = {
  /**
   * Check if user has seen the welcome screen
   * SYNCHRONOUS - can be called during render without await
   *
   * @returns true if user has completed onboarding, false otherwise
   */
  hasSeenWelcome(): boolean {
    const value = mmkvStorage.getBoolean(KEY_HAS_SEEN_WELCOME);
    // Return false if key doesn't exist (first install)
    return value ?? false;
  },

  /**
   * Mark welcome screen as seen
   * Called when user taps "Get Started" on WelcomeScreen
   * SYNCHRONOUS - writes happen instantly
   */
  markWelcomeSeen(): void {
    mmkvStorage.setBoolean(KEY_HAS_SEEN_WELCOME, true);
    if (__DEV__) {
      Logger.debug('[Onboarding] Welcome screen marked as seen');
    }
  },

  /**
   * Reset onboarding state (for testing/debugging only)
   * User will see welcome screen again on next app launch
   */
  resetOnboarding(): void {
    mmkvStorage.remove(KEY_HAS_SEEN_WELCOME);
    if (__DEV__) {
      Logger.debug('[Onboarding] Onboarding state reset - welcome will show on next launch');
    }
  },
} as const;
