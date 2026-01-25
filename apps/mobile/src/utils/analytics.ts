/**
 * Analytics Service
 *
 * Centralized analytics tracking for user interactions
 * Can be extended to integrate with services like:
 * - Google Analytics
 * - Firebase Analytics
 * - Mixpanel
 * - Segment
 */

import { Logger } from './logger';

interface EventProperties {
  [key: string]: string | number | boolean | string[] | undefined;
}

interface FilterAppliedProperties {
  offerType?: string;
  establishmentCount: number;
  establishmentTypes: string[];
  cuisineCount: number;
  cuisineTypes: string[];
  categoryCount: number;
  categories: string[];
  totalFilters: number;
  source: string;
}

interface FilterRemovedProperties {
  filterType: 'offerType' | 'establishmentType' | 'cuisineType' | 'category';
  value: string;
  source: string;
}

interface FiltersClearedProperties {
  previousFilterCount: number;
  source: string;
}

class Analytics {
  private enabled: boolean = __DEV__; // Enabled in development, can be toggled in production

  /**
   * Track a custom event
   */
  track(eventName: string, properties?: EventProperties): void {
    if (!this.enabled) {
      return;
    }

    try {
      // Log to console in development
      Logger.info(`[Analytics] ${eventName}`, properties);

      // TODO: Add third-party analytics integration here
      // Example:
      // firebase.analytics().logEvent(eventName, properties);
      // mixpanel.track(eventName, properties);
      // segment.track(eventName, properties);
    } catch (error) {
      Logger.error('Analytics tracking failed', { eventName, error });
    }
  }

  /**
   * Track filter application
   */
  trackFiltersApplied(properties: FilterAppliedProperties): void {
    this.track('filters_applied', properties);
  }

  /**
   * Track single filter removal
   */
  trackFilterRemoved(properties: FilterRemovedProperties): void {
    this.track('filter_removed', properties);
  }

  /**
   * Track all filters cleared
   */
  trackFiltersCleared(properties: FiltersClearedProperties): void {
    this.track('filters_cleared', properties);
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, params?: EventProperties): void {
    this.track('screen_view', { screen_name: screenName, ...params });
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    Logger.info(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: EventProperties): void {
    if (!this.enabled) {
      return;
    }

    try {
      Logger.info('[Analytics] User properties set', properties);
      // TODO: Add third-party analytics integration
      // firebase.analytics().setUserProperties(properties);
      // mixpanel.people.set(properties);
    } catch (error) {
      Logger.error('Failed to set user properties', { error });
    }
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    if (!this.enabled) {
      return;
    }

    try {
      Logger.info('[Analytics] User ID set', { userId });
      // TODO: Add third-party analytics integration
      // firebase.analytics().setUserId(userId);
      // mixpanel.identify(userId);
    } catch (error) {
      Logger.error('Failed to set user ID', { error });
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export types for use in components
export type {
  EventProperties,
  FilterAppliedProperties,
  FilterRemovedProperties,
  FiltersClearedProperties,
};
