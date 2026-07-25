/**
 * useHomeOffers Hook
 * Centralized data fetching for HomeScreen with lazy loading
 *
 * Responsibilities:
 * - Consolidate 4 separate API queries
 * - Implement lazy loading (priority-based)
 * - Centralized error handling
 * - Refresh management
 *
 * Best Practice: Implement lazy loading to improve initial render performance
 * Load critical data first, then lazy load secondary data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

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
// Constants
// ============================================================================

/** Section order — must match the refetch order in `refetchAll`. */
const SECTION_NAMES = ['urgent', 'hottest', 'pickupToday', 'pickupTomorrow'] as const;

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
 * - Urgent offers fetch on mount; the other three are gated behind
 *   HOME_UI_CONFIG.LAZY_LOAD_DELAY_MS so the first paint isn't competing
 *   with four parallel requests. No measured figures are quoted here on
 *   purpose — profile before claiming any.
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
  const {
    data: urgentOffers,
    isLoading: isUrgentLoading,
    error: urgentError,
    refetch: refetchUrgent,
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
  const {
    data: hottestDealsRaw,
    isLoading: isHottestLoading,
    error: hottestError,
    refetch: refetchHottest,
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
  // Memoized: this derived object is a render input downstream, so it must only
  // change identity when the underlying query data changes.
  const hottestDeals = useMemo(() => {
    if (!hottestDealsRaw) return undefined;

    const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
    return {
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
    };
  }, [hottestDealsRaw]);

  /**
   * PRIORITY 3: Pickup today offers
   * Loads after 500ms delay
   */
  const {
    data: pickupTodayOffers,
    isLoading: isPickupTodayLoading,
    error: pickupTodayError,
    refetch: refetchPickupToday,
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
  const {
    data: pickupTomorrowOffers,
    isLoading: isPickupTomorrowLoading,
    error: pickupTomorrowError,
    refetch: refetchPickupTomorrow,
  } = usePickupTomorrowOffers(
    HOME_API_CONFIG.PICKUP_TOMORROW_LIMIT,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined,
    filterParams,
    {
      enabled: loadSecondaryData,
    },
  );

  // ============================================================================
  // Aggregated State
  // ============================================================================

  // Memoized so the identity only changes when a loading flag actually flips.
  // Consumers use these objects as render/memo inputs — a fresh object on every
  // render would defeat React.memo on the sections and force needless repaints.
  const isLoading: OffersLoadingState = useMemo(
    () => ({
      urgent: isUrgentLoading,
      hottest: isHottestLoading,
      pickupToday: isPickupTodayLoading,
      pickupTomorrow: isPickupTomorrowLoading,
    }),
    [isUrgentLoading, isHottestLoading, isPickupTodayLoading, isPickupTomorrowLoading],
  );

  /**
   * Aggregated error states
   */
  const errors: OffersErrorState = useMemo(
    () => ({
      urgent: urgentError,
      hottest: hottestError,
      pickupToday: pickupTodayError,
      pickupTomorrow: pickupTomorrowError,
    }),
    [urgentError, hottestError, pickupTodayError, pickupTomorrowError],
  );

  // ============================================================================
  // Callbacks - Refetch Functions
  // ============================================================================

  /**
   * Refetch all offers
   * Used for pull-to-refresh
   */
  const refetchAll = useCallback(async () => {
    // allSettled: one failing section must not abort the other three.
    const results = await Promise.allSettled([
      refetchUrgent(),
      refetchHottest(),
      refetchPickupToday(),
      refetchPickupTomorrow(),
    ]);

    const failed = results
      .map((r, i) => ({ query: SECTION_NAMES[i], result: r }))
      .filter(({ result }) => result.status === 'rejected');

    if (failed.length > 0) {
      Logger.warn('[useHomeOffers] Some sections failed to refresh', {
        failed: failed.map(({ query, result }) => ({
          query,
          reason: String((result as PromiseRejectedResult).reason),
        })),
      });
    }
  }, [refetchUrgent, refetchHottest, refetchPickupToday, refetchPickupTomorrow]);

  /**
   * Aggregated refetch functions
   */
  const refetch: OffersRefetchFunctions = useMemo(
    () => ({
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
    }),
    [refetchUrgent, refetchHottest, refetchPickupToday, refetchPickupTomorrow, refetchAll],
  );

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
