/**
 * Analytics Service (Stub)
 *
 * Firebase Analytics was removed to reduce APK size.
 * This stub preserves the public API so callers don't need changes.
 * Replace with Sentry performance monitoring or another provider when needed.
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
  [key: string]: string | number | boolean | string[] | undefined;
}

interface FilterRemovedProperties {
  filterType:
    | 'offerType'
    | 'establishmentType'
    | 'establishmentCategory'
    | 'cuisineType'
    | 'category';
  value: string;
  source: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

interface FiltersClearedProperties {
  previousFilterCount: number;
  source: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

class Analytics {
  track(eventName: string, properties?: EventProperties): void {
    if (__DEV__) {
      Logger.debug(`[Analytics] ${eventName}`, properties);
    }
  }

  trackScreenView(screenName: string, _screenClass?: string): void {
    if (__DEV__) {
      Logger.debug(`[Analytics] screen_view: ${screenName}`);
    }
  }

  setUserId(_userId: string | null): void {}
  setUserProperties(_properties: Record<string, string | null>): void {}

  trackOfferViewed(offerId: string, title: string, price?: number): void {
    this.track('offer_viewed', {
      offer_id: offerId,
      offer_title: title,
      ...(price !== undefined ? { price } : {}),
    });
  }

  trackCheckoutStarted(offerId: string, offerTitle: string, price: number, quantity: number): void {
    this.track('checkout_started', { offer_id: offerId, offer_title: offerTitle, price, quantity });
  }

  trackOrderPlaced(orderId: string, orderNumber: string, total: number, currency: string): void {
    this.track('order_placed', { order_id: orderId, order_number: orderNumber, total, currency });
  }

  trackPickupConfirmed(orderId: string, orderNumber: string): void {
    this.track('pickup_confirmed', { order_id: orderId, order_number: orderNumber });
  }

  trackFiltersApplied(properties: FilterAppliedProperties): void {
    this.track('filters_applied', properties);
  }

  trackFilterRemoved(properties: FilterRemovedProperties): void {
    this.track('filter_removed', properties);
  }

  trackFiltersCleared(properties: FiltersClearedProperties): void {
    this.track('filters_cleared', properties);
  }

  setCollectionEnabled(_enabled: boolean): void {}
}

export const analytics = new Analytics();
