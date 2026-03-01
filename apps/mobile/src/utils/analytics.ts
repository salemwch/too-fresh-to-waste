/**
 * Analytics Service
 *
 * Thin wrapper around @react-native-firebase/analytics.
 * Gated by environment.monitoring.enableAnalytics so dev builds
 * never pollute production data and the flag can be toggled per env.
 *
 * All methods are fire-and-forget; failures are swallowed so a
 * tracking hiccup can never crash the app.
 */

import {
  getAnalytics,
  logEvent,
  logScreenView,
  logPurchase,
  setUserId as firebaseSetUserId,
  setUserProperties as firebaseSetUserProperties,
  setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';

import { environment } from '@/config/environment';
import { Logger } from './logger';

// ─── Public property shape ────────────────────────────────────────────────────

export interface EventProperties {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface FilterAppliedProperties {
  offerType?: string;
  establishmentCount: number;
  establishmentTypes: string[];
  cuisineCount: number;
  cuisineTypes: string[];
  categoryCount: number;
  categories: string[];
  totalFilters: number;
  source: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface FilterRemovedProperties {
  filterType: 'offerType' | 'establishmentType' | 'cuisineType' | 'category';
  value: string;
  source: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface FiltersClearedProperties {
  previousFilterCount: number;
  source: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Firebase Analytics only accepts string | number | boolean param values.
 * Arrays must be JSON-stringified before passing in.
 */
function serializeParams(
  props: EventProperties | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;

  const result: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    result[k] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return result;
}

// ─── Analytics class ──────────────────────────────────────────────────────────

class Analytics {
  private get enabled(): boolean {
    return environment.monitoring.enableAnalytics;
  }

  // ── Core ───────────────────────────────────────────────────────────────────

  /** Log a generic custom event. */
  track(eventName: string, properties?: EventProperties): void {
    if (!this.enabled) return;
    try {
      void logEvent(getAnalytics(), eventName, serializeParams(properties));
      if (__DEV__) {
        Logger.debug(`[Analytics] ${eventName}`, properties);
      }
    } catch (error) {
      Logger.warn('[Analytics] track failed', { eventName }, error as Error);
    }
  }

  /** Log a screen_view event (recommended by Firebase). */
  trackScreenView(screenName: string, screenClass?: string): void {
    if (!this.enabled) return;
    try {
      void logScreenView(getAnalytics(), {
        screen_name: screenName,
        screen_class: screenClass ?? screenName,
      });
      if (__DEV__) {
        Logger.debug(`[Analytics] screen_view: ${screenName}`);
      }
    } catch (error) {
      Logger.warn('[Analytics] trackScreenView failed', { screenName }, error as Error);
    }
  }

  // ── Identity ───────────────────────────────────────────────────────────────

  /** Associate all subsequent events with this user ID. */
  setUserId(userId: string | null): void {
    if (!this.enabled) return;
    try {
      void firebaseSetUserId(getAnalytics(), userId);
    } catch (error) {
      Logger.warn('[Analytics] setUserId failed', {}, error as Error);
    }
  }

  /** Set persistent user-scoped properties (e.g. user_role, loyalty_tier). */
  setUserProperties(properties: Record<string, string | null>): void {
    if (!this.enabled) return;
    try {
      void firebaseSetUserProperties(getAnalytics(), properties);
    } catch (error) {
      Logger.warn('[Analytics] setUserProperties failed', {}, error as Error);
    }
  }

  // ── Offer events ───────────────────────────────────────────────────────────

  /** Fired when OfferDetailsScreen mounts with a loaded offer. */
  trackOfferViewed(offerId: string, title: string, price?: number): void {
    this.track('offer_viewed', {
      offer_id: offerId,
      offer_title: title,
      ...(price !== undefined ? { price } : {}),
    });
  }

  // ── Checkout events ────────────────────────────────────────────────────────

  /** Fired when CheckoutScreen loads its offer data (intent to purchase). */
  trackCheckoutStarted(offerId: string, offerTitle: string, price: number, quantity: number): void {
    this.track('checkout_started', {
      offer_id: offerId,
      offer_title: offerTitle,
      price,
      quantity,
    });
  }

  /** Fired after createOrder succeeds. */
  trackOrderPlaced(orderId: string, orderNumber: string, total: number, currency: string): void {
    // Firebase predefined purchase event keeps funnels comparable across projects
    if (this.enabled) {
      try {
        void logPurchase(getAnalytics(), {
          transaction_id: orderId,
          value: total,
          currency,
          items: [{ item_id: orderNumber }],
        });
      } catch (error) {
        Logger.warn('[Analytics] trackOrderPlaced failed', {}, error as Error);
      }
    }
    // Also log custom event for our own dashboards
    this.track('order_placed', {
      order_id: orderId,
      order_number: orderNumber,
      total,
      currency,
    });
  }

  // ── Order events ───────────────────────────────────────────────────────────

  /** Fired after a successful pickup code confirmation. */
  trackPickupConfirmed(orderId: string, orderNumber: string): void {
    this.track('pickup_confirmed', { order_id: orderId, order_number: orderNumber });
  }

  // ── Filter events ──────────────────────────────────────────────────────────

  trackFiltersApplied(properties: FilterAppliedProperties): void {
    this.track('filters_applied', properties);
  }

  trackFilterRemoved(properties: FilterRemovedProperties): void {
    this.track('filter_removed', properties);
  }

  trackFiltersCleared(properties: FiltersClearedProperties): void {
    this.track('filters_cleared', properties);
  }

  // ── Control ────────────────────────────────────────────────────────────────

  /**
   * Propagate the consent / opt-out state to Firebase.
   * When disabled Firebase will stop collecting data immediately.
   */
  setCollectionEnabled(enabled: boolean): void {
    try {
      void setAnalyticsCollectionEnabled(getAnalytics(), enabled);
      Logger.info(`[Analytics] collection ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Logger.warn('[Analytics] setCollectionEnabled failed', {}, error as Error);
    }
  }
}

// Singleton — one instance for the lifetime of the app
export const analytics = new Analytics();
