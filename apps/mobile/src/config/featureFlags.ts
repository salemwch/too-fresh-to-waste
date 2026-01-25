/**
 * Feature Flags Configuration
 *
 * Best Practice: Use feature flags for gradual rollouts and safe experimentation
 *
 * Benefits:
 * - Instant rollback without app update
 * - A/B testing
 * - Gradual user migration
 * - Kill switch for problematic features
 *
 * @see https://martinfowler.com/articles/feature-toggles.html
 */

import { isDevelopment, isStaging, isProduction } from './environment';

/**
 * Feature flag definitions
 */
export interface FeatureFlags {
  // Authentication & API
  useApiClientV2: boolean;              // New centralized API client with auto token refresh
  usePreemptiveTokenRefresh: boolean;   // Refresh token 5min before expiry
  useBiometricReauth: boolean;          // Quick biometric re-auth instead of full login

  // Performance
  enableRequestQueueing: boolean;       // Queue concurrent 401 requests
  enableResponseCaching: boolean;       // Cache GET requests

  // Monitoring
  enableDetailedLogging: boolean;       // Verbose API logs
  enableErrorReporting: boolean;        // Send errors to Sentry
}

/**
 * Get feature flags for current environment
 */
export const getFeatureFlags = (): FeatureFlags => {
  // ✅ PHASE 1: START NOW - Enable in development for testing
  const useApiClientV2 = isDevelopment() || isStaging();

  return {
    // API Client V2 - ENABLED IN DEV/STAGING NOW
    useApiClientV2,
    usePreemptiveTokenRefresh: false, // Phase 2
    useBiometricReauth: false,        // Phase 3

    // Performance - Enabled everywhere
    enableRequestQueueing: true,
    enableResponseCaching: true,

    // Monitoring
    enableDetailedLogging: isDevelopment(),
    enableErrorReporting: isProduction(),
  };
};

/**
 * Singleton instance
 */
export const featureFlags = getFeatureFlags();

/**
 * Check if feature is enabled
 * @param flag - Feature flag name
 * @returns True if enabled
 */
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return featureFlags[flag];
};

/**
 * 🚀 ROLLOUT STATUS: PHASE 1 ACTIVE
 *
 * Current State:
 * - ✅ development: useApiClientV2 = true (LIVE NOW)
 * - ✅ staging: useApiClientV2 = true (LIVE NOW)
 * - ⏳ production: useApiClientV2 = false (Week 2)
 *
 * Rollout Plan for useApiClientV2:
 *
 * ✅ Week 1 (Internal Testing - CURRENT):
 * - development: true ← YOU ARE HERE
 * - staging: true
 * - production: false
 * - Team: Test all auth flows
 *
 * Week 2 (Beta 5%):
 * - production: true (for 5% of users via remote config)
 * - Monitor: 401 errors, token refresh success rate
 *
 * Week 3 (Beta 20%):
 * - production: true (for 20% of users)
 * - Monitor: Session duration, user complaints
 *
 * Week 4 (Full Rollout):
 * - production: true (100% of users)
 * - Remove old code after 1 week of stability
 */
