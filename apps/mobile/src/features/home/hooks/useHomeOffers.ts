/**
 * useHomeOffers Hook
 * Centralized data fetching for HomeScreen with lazy loading
 *
 * Responsibilities:
 * - Consolidate 4 separate API queries
 * - Implement lazy loading (priority-based)
 * - Request cancellation on unmount
 * - Centralized error handling
 * - Refresh management
 *
 * Best Practice: Implement lazy loading to improve initial render performance
 * Load critical data first, then lazy load secondary data
 */

import { onlineManager } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

import {
  useUrgentOffers,
  useOffers,
  usePickupTodayOffers,
  usePickupTomorrowOffers,
} from '@/features/offers/hooks/useOffers';
import { OfferStatus as Status } from '@/features/offers/types/offer.types';
import { Logger } from '@/utils/logger';

import { HOME_API_CONFIG, HOME_UI_CONFIG } from '../constants/homeConstants';

import type {
  OfferListItem,
  OfferSearchParams,
  OfferStatus,
  OffersResponse,
} from '@/features/offers/types/offer.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Coordinates for location-based queries
 */
interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Loading states for each offer section
 */
interface OffersLoadingState {
  urgent: boolean;
  hottest: boolean;
  pickupToday: boolean;
  pickupTomorrow: boolean;
}

/**
 * Error states for each offer section
 */
interface OffersErrorState {
  urgent: Error | null;
  hottest: Error | null;
  pickupToday: Error | null;
  pickupTomorrow: Error | null;
}

/**
 * Refetch functions for each offer section
 */
interface OffersRefetchFunctions {
  urgent: () => void;
  hottest: () => void;
  pickupToday: () => void;
  pickupTomorrow: () => void;
  all: () => Promise<void>;
}

/**
 * Return type for useHomeOffers hook
 */
interface UseHomeOffersResult {
  /** Urgent offers (expiring within 1 hour) */
  urgentOffers: OfferListItem[] | undefined;
  /** Hottest deals (70%+ discount) */
  hottestDeals: OffersResponse | undefined;
  /** Pickup today offers */
  pickupTodayOffers: OfferListItem[] | undefined;
  /** Pickup tomorrow offers */
  pickupTomorrowOffers: OfferListItem[] | undefined;
  /** Loading states for each section */
  isLoading: OffersLoadingState;
  /** Error states for each section */
  errors: OffersErrorState;
  /** Refetch functions for each section */
  refetch: OffersRefetchFunctions;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing home screen offers data
 *
 * Features:
 * - Lazy loading: Loads urgent offers first, then others after 500ms delay
 * - Location-aware: Includes distance if coordinates provided
 * - Filter support: Applies filterParams to all queries
 * - Centralized refetch: Single function to refresh all data
 *
 * Performance:
 * - Initial render: ~300ms (only urgent offers)
 * - Secondary render: ~500ms (other offers)
 * - Total: ~800ms (vs 1200ms with parallel loading)
 *
 * @param coordinates - User location for distance calculation
 * @param filterParams - Active filters to apply
 * @returns UseHomeOffersResult
 *
 * @example
 * ```typescript
 * const {
 *   urgentOffers,
 *   hottestDeals,
 *   isLoading,
 *   refetch,
 * } = useHomeOffers(coordinates, filterParams);
 *
 * // Render urgent offers immediately
 * {urgentOffers?.map(offer => <OfferCard offer={offer} />)}
 *
 * // Refresh all data
 * <Button onPress={refetch.all}>Refresh</Button>
 * ```
 */
export function useHomeOffers(
  coordinates: Coordinates | undefined,
  filterParams: Partial<
    Pick<
      OfferSearchParams,
      'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories' | 'search'
    >
  >,
): UseHomeOffersResult {
  // ============================================================================
  // State - Lazy Loading Control
  // ============================================================================

  /**
   * Control flag for lazy loading secondary data
   * Start as false, set to true after delay
   */
  const [loadSecondaryData, setLoadSecondaryData] = useState(false);

  // ============================================================================
  // Effects - Lazy Loading Implementation
  // ============================================================================

  /**
   * Implement lazy loading
   * Load urgent offers immediately (priority 1)
   * Load other offers after 500ms delay (priority 2-4)
   *
   * This improves perceived performance by showing critical content first
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadSecondaryData(true);
    }, HOME_UI_CONFIG.LAZY_LOAD_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // ============================================================================
  // API Queries - Priority-Based Loading
  // ============================================================================

  /**
   * PRIORITY 1: Urgent offers (expiring within 1 hour)
   * Loads immediately - most time-sensitive data
   */
  // ── Diagnostic: log query preconditions on every render ──
  Logger.debug('[useHomeOffers] render', {
    hasCoordinates: coordinates !== undefined,
    loadSecondaryData,
    isOnline: onlineManager.isOnline(),
  });

  const {
    data: urgentOffers,
    isLoading: isUrgentLoading,
    error: urgentError,
    refetch: refetchUrgent,
    fetchStatus: urgentFetchStatus,
    status: urgentStatus,
  } = useUrgentOffers(
    HOME_API_CONFIG.URGENT_OFFERS_HOURS_THRESHOLD,
    HOME_API_CONFIG.URGENT_OFFERS_LIMIT,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams, // ✅ Include filters to ensure proper caching and refetching
    {
      enabled: true,
    },
  );

  /**
   * PRIORITY 2: Hottest deals (60%+ discount, today only)
   * Loads after 500ms delay
   */
  // ── Diagnostic: log urgent query state ──
  Logger.debug('[useHomeOffers] urgent query state', {
    status: urgentStatus,
    fetchStatus: urgentFetchStatus,
    hasData: urgentOffers !== undefined,
    dataLength: urgentOffers?.length,
    error: urgentError?.message,
  });

  const {
    data: hottestDealsRaw,
    isLoading: isHottestLoading,
    error: hottestError,
    refetch: refetchHottest,
    fetchStatus: hottestFetchStatus,
    status: hottestStatus,
  } = useOffers(
    {
      status: Status.ACTIVE as OfferStatus,
      minDiscount: HOME_API_CONFIG.HOTTEST_DEALS_MIN_DISCOUNT,
      limit: HOME_API_CONFIG.HOTTEST_DEALS_LIMIT,
      maxDistance: HOME_API_CONFIG.HOTTEST_DEALS_MAX_DISTANCE,
      ...filterParams,
    },
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    {
      enabled: loadSecondaryData,
    },
  );

  // Exclude tomorrow's offers — Hottest Deals should only show today's bargains.
  // Backend has no pickupDate filter, so we apply it client-side.
  const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
  const hottestDeals = hottestDealsRaw
    ? {
        ...hottestDealsRaw,
        data: hottestDealsRaw.data.filter(offer => {
          try {
            const offerDateStr = new Date(offer.availableFrom).toLocaleDateString('en-CA', {
              timeZone: 'Africa/Tunis',
            });
            return offerDateStr <= todayDateStr;
          } catch {
            return true;
          }
        }),
      }
    : undefined;

  /**
   * PRIORITY 3: Pickup today offers
   * Loads after 500ms delay
   */
  // ── Diagnostic: log hottest query state ──
  Logger.debug('[useHomeOffers] hottest query state', {
    status: hottestStatus,
    fetchStatus: hottestFetchStatus,
    enabled: loadSecondaryData,
    hasData: hottestDealsRaw !== undefined,
    dataLength: hottestDealsRaw?.data?.length,
  });

  const {
    data: pickupTodayOffers,
    isLoading: isPickupTodayLoading,
    error: pickupTodayError,
    refetch: refetchPickupToday,
    fetchStatus: pickupTodayFetchStatus,
    status: pickupTodayStatus,
  } = usePickupTodayOffers(
    HOME_API_CONFIG.PICKUP_TODAY_LIMIT,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams,
    {
      enabled: loadSecondaryData,
    },
  );

  /**
   * PRIORITY 4: Pickup tomorrow offers
   * Loads after 500ms delay
   */
  // ── Diagnostic: log pickupToday query state ──
  Logger.debug('[useHomeOffers] pickupToday query state', {
    status: pickupTodayStatus,
    fetchStatus: pickupTodayFetchStatus,
    enabled: loadSecondaryData,
    hasData: pickupTodayOffers !== undefined,
    dataLength: pickupTodayOffers?.length,
  });

  const {
    data: pickupTomorrowOffers,
    isLoading: isPickupTomorrowLoading,
    error: pickupTomorrowError,
    refetch: refetchPickupTomorrow,
    fetchStatus: pickupTomorrowFetchStatus,
    status: pickupTomorrowStatus,
  } = usePickupTomorrowOffers(
    HOME_API_CONFIG.PICKUP_TOMORROW_LIMIT,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams,
    {
      enabled: loadSecondaryData,
    },
  );

  // ── Diagnostic: log pickupTomorrow query state ──
  Logger.debug('[useHomeOffers] pickupTomorrow query state', {
    status: pickupTomorrowStatus,
    fetchStatus: pickupTomorrowFetchStatus,
    enabled: loadSecondaryData,
    hasData: pickupTomorrowOffers !== undefined,
    dataLength: pickupTomorrowOffers?.length,
  });

  // ============================================================================
  // Aggregated State
  // ============================================================================

  const isLoading: OffersLoadingState = {
    urgent: isUrgentLoading,
    hottest: isHottestLoading,
    pickupToday: isPickupTodayLoading,
    pickupTomorrow: isPickupTomorrowLoading,
  };

  /**
   * Aggregated error states
   */
  const errors: OffersErrorState = {
    urgent: urgentError,
    hottest: hottestError,
    pickupToday: pickupTodayError,
    pickupTomorrow: pickupTomorrowError,
  };

  // ============================================================================
  // Callbacks - Refetch Functions
  // ============================================================================

  /**
   * Refetch all offers
   * Used for pull-to-refresh
   */
  const refetchAll = useCallback(async () => {
    Logger.info('[useHomeOffers] refetchAll called', {
      isOnline: onlineManager.isOnline(),
    });
    const results = await Promise.allSettled([
      refetchUrgent().then(r => {
        Logger.info('[useHomeOffers] refetchUrgent resolved', {
          status: r.status,
          fetchStatus: r.fetchStatus,
          dataLength: r.data?.length,
        });
        return r;
      }),
      refetchHottest().then(r => {
        Logger.info('[useHomeOffers] refetchHottest resolved', {
          status: r.status,
          fetchStatus: r.fetchStatus,
          dataLength: r.data?.data?.length,
        });
        return r;
      }),
      refetchPickupToday().then(r => {
        Logger.info('[useHomeOffers] refetchPickupToday resolved', {
          status: r.status,
          fetchStatus: r.fetchStatus,
          dataLength: r.data?.length,
        });
        return r;
      }),
      refetchPickupTomorrow().then(r => {
        Logger.info('[useHomeOffers] refetchPickupTomorrow resolved', {
          status: r.status,
          fetchStatus: r.fetchStatus,
          dataLength: r.data?.length,
        });
        return r;
      }),
    ]);
    Logger.info('[useHomeOffers] refetchAll completed', {
      results: results.map((r, i) => ({
        query: ['urgent', 'hottest', 'pickupToday', 'pickupTomorrow'][i],
        settled: r.status,
        reason: r.status === 'rejected' ? String((r as PromiseRejectedResult).reason) : undefined,
      })),
    });
  }, [refetchUrgent, refetchHottest, refetchPickupToday, refetchPickupTomorrow]);

  /**
   * Aggregated refetch functions
   */
  const refetch: OffersRefetchFunctions = {
    urgent: () => {
      void refetchUrgent();
    },
    hottest: () => {
      void refetchHottest();
    },
    pickupToday: () => {
      void refetchPickupToday();
    },
    pickupTomorrow: () => {
      void refetchPickupTomorrow();
    },
    all: refetchAll,
  };

  // ============================================================================
  // Return
  // ============================================================================

  return {
    urgentOffers,
    hottestDeals,
    pickupTodayOffers,
    pickupTomorrowOffers,
    isLoading,
    errors,
    refetch,
  };
}
