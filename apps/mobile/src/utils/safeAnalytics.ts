/**
 * Safe Analytics Wrapper
 *
 * CRITICAL: Analytics tracking should NEVER break business-critical flows
 *
 * This wrapper ensures:
 * 1. Analytics failures don't throw errors
 * 2. Graceful degradation when analytics unavailable
 * 3. Warnings in dev, silent in production
 * 4. Type-safe interface
 *
 * Industry Standard: Facebook, Google, Amazon, Stripe all use safe wrappers
 * Reference: "Never let observability break functionality"
 */

import { Logger } from './logger';

/**
 * Event properties type
 */
interface EventProperties {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Safe Analytics Service
 * Wraps analytics calls with defensive error handling
 */
class SafeAnalyticsService {
  private analytics: { track?: (event: string, props?: EventProperties) => void } | null =
    null;

  /**
   * Optional initializer (call this if/when you enable analytics)
   */
  init(analyticsClient: { track: (event: string, props?: EventProperties) => void }) {
    this.analytics = analyticsClient;
  }

  /**
   * Track an event safely
   * NEVER throws — safe for critical flows
   */
  track(eventName: string, properties?: EventProperties): void {
    try {
      if (!this.analytics || typeof this.analytics.track !== 'function') {
        if (__DEV__) {
          Logger.warn('[SAFE-ANALYTICS] Analytics not available, skipping event', {
            eventName,
            properties,
          });
        }
        return;
      }

      this.analytics.track(eventName, properties);
    } catch (error) {
      if (__DEV__) {
        Logger.warn('[SAFE-ANALYTICS] Failed to track event (non-critical)', {
          eventName,
          error: error instanceof Error ? error.message : String(error),
        });
        console.warn('[SAFE-ANALYTICS] Analytics error:', error);
      }
      // Production: silent fail
    }
  }

  trackError(errorName: string, errorDetails?: EventProperties): void {
    this.track(`error_${errorName}`, errorDetails);
  }

  trackTiming(
    timingName: string,
    durationMs: number,
    additionalProps?: EventProperties,
  ): void {
    this.track(timingName, {
      duration_ms: durationMs,
      ...additionalProps,
    });
  }
}

export const SafeAnalytics = new SafeAnalyticsService();
