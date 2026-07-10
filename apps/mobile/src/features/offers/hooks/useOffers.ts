/**
 * Offers Hooks
 *
 * TanStack Query hooks for fetching and mutating offers data.
 * Provides caching, automatic refetching, and optimistic updates.
 */

import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { Logger } from '@/utils/logger';

import { offersService } from '../services/offersService';

import type { OfferListItem, OfferSearchParams, OffersResponse, Offer } from '../types/offer.types';

// ============================================================================
// Helpers
// ============================================================================

type OfferFilters = Pick<
  OfferSearchParams,
  'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'
>;

function applyClientSideFilters(offers: OfferListItem[], filters?: OfferFilters): OfferListItem[] {
  let result = Array.isArray(offers) ? offers : [];
  if (filters === undefined) return result;

  if (filters.type !== undefined) {
    result = result.filter(offer => offer.type === filters.type);
  }
  const categories = filters.categories;
  if (Array.isArray(categories) && categories.length > 0) {
    result = result.filter(offer => categories.some(cat => (offer.categories ?? []).includes(cat)));
  }
  if (
    (Array.isArray(filters.establishmentTypes) && filters.establishmentTypes.length > 0) ||
    (Array.isArray(filters.cuisineTypes) && filters.cuisineTypes.length > 0)
  ) {
    Logger.warn(
      'Establishment/cuisine filtering not fully supported for this endpoint - use general search instead',
    );
  }
  return result;
}

// ============================================================================
// Query Keys (for cache management)
// ============================================================================

const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (filters: OfferSearchParams) => [...offerKeys.lists(), filters] as const,
  details: () => [...offerKeys.all, 'detail'] as const,
  detail: (id: string) => [...offerKeys.details(), id] as const,
  pickupToday: (limit: number, dateStr: string) =>
    [...offerKeys.all, 'pickup-today', limit, dateStr] as const,
  pickupTomorrow: (limit: number, dateStr: string) =>
    [...offerKeys.all, 'pickup-tomorrow', limit, dateStr] as const,
};

// ============================================================================
// Query Hooks (Data Fetching)
// ============================================================================

/**
 * Fetch single offer by ID
 *
 * @param offerId - Offer ID to fetch
 * @param options - TanStack Query options
 * @returns Query result with offer data, loading state, and error
 *
 * @example
 * const { data: offer, isLoading, error } = useOffer('69507a5fc209cc6502ff92f0');
 */
export function useOffer(
  offerId: string,
  options?: Omit<UseQueryOptions<Offer, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Offer, Error>({
    queryKey: offerKeys.detail(offerId),
    queryFn: async ({ signal }) => {
      Logger.info('Fetching offer', { offerId });
      const offer = await offersService.getOfferById(offerId, signal);

      // Debug logging to see what we got
      Logger.info('Offer fetched - full response:', {
        offerId,
        hasOffer: true,
        hasPricing: offer.pricing !== undefined,
        offerKeys: Object.keys(offer),
        pricing: offer.pricing,
      });

      Logger.info('Offer fetched successfully', { offerId, title: offer.title });
      return offer;
    },
    enabled: !!offerId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 2, // Retry failed requests twice
    ...options,
  });
}

/**
 * Fetch all offers with optional filters
 *
 * @param params - Search and filter parameters
 * @param userLocation - Optional user location for distance calculation
 * @param options - TanStack Query options
 * @returns Query result with paginated offers
 *
 * @example
 * const { data, isLoading } = useOffers({ page: 1, limit: 20, status: OfferStatus.ACTIVE });
 */
export function useOffers(
  params?: OfferSearchParams,
  userLocation?: { latitude: number; longitude: number },
  options?: Omit<UseQueryOptions<OffersResponse, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OffersResponse, Error>({
    queryKey: [...offerKeys.list(params ?? {}), userLocation],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching offers', { params });
      const response = await offersService.getAllOffers(params, userLocation, signal);
      // Handle undefined or malformed responses
      const validResponse = response ?? {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      Logger.info('Offers fetched successfully', {
        total: validResponse.meta?.total,
        page: validResponse.meta?.page,
      });
      return validResponse;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

/**
 * Fetch urgent offers (expiring soon)
 *
 * Returns offers expiring within a specified time window (default: 1 hour).
 * Designed for "Urgent Deals" sections that show offers based on actual
 * time remaining, not manual/auto featuring flags.
 *
 * @param hoursUntilExpiry - Maximum hours until expiry (default: 1)
 * @param limit - Maximum number of offers (default 10)
 * @param userLocation - Optional user location for distance calculation
 * @param filters - Optional filters (type, establishmentTypes, cuisineTypes, categories)
 * @param options - TanStack Query options
 * @returns Query result with urgent offers sorted by soonest expiring first
 *
 * @example
 * const { data: urgentOffers, isLoading } = useUrgentOffers(1, 10, coordinates, { establishmentTypes: ['BAKERY'] });
 */
export function useUrgentOffers(
  hoursUntilExpiry: number = 1,
  limit: number = 10,
  userLocation?: { latitude: number; longitude: number },
  filters?: Pick<OfferSearchParams, 'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'>,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.all, 'urgent', hoursUntilExpiry, limit, userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching urgent offers', { hoursUntilExpiry, limit, userLocation, filters });
      const offers = await offersService.getUrgentOffers(
        hoursUntilExpiry,
        limit,
        userLocation,
        signal,
      );
      const validOffers = applyClientSideFilters(offers, filters);
      Logger.info('Urgent offers fetched and filtered', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 1, // Consider data fresh for 1 minute (very time-sensitive)
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes only
    ...options,
  });
}

/**
 * Fetch offers available for pickup today with optional filters
 *
 * @param limit - Maximum number of offers (default 20)
 * @param userLocation - Optional user location for distance calculation
 * @param filters - Optional filter parameters (establishment type, cuisine, categories, offer type)
 * @param options - TanStack Query options
 * @returns Query result with pickup today offers
 *
 * @example
 * const { data: pickupTodayOffers, isLoading } = usePickupTodayOffers(20, { latitude: 36.8, longitude: 10.2 }, { establishmentTypes: ['BAKERY'] });
 */
export function usePickupTodayOffers(
  limit: number = 20,
  userLocation?: { latitude: number; longitude: number },
  filters?: Pick<OfferSearchParams, 'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'>,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  // Include Tunisia-local date so the cache key changes at midnight and the
  // offer moves from "tomorrow" to "today" without a manual refresh.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.pickupToday(limit, todayStr), userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching pickup today offers', { limit, userLocation, filters });
      const offers = await offersService.getPickupTodayOffers(limit, userLocation, signal);
      const validOffers = applyClientSideFilters(offers, filters);
      Logger.info('Pickup today offers fetched and filtered', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes (time-sensitive)
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

/**
 * Fetch offers available for pickup tomorrow with optional filters
 *
 * @param limit - Maximum number of offers (default 20)
 * @param userLocation - Optional user location for distance calculation
 * @param filters - Optional filter parameters (establishment type, cuisine, categories, offer type)
 * @param options - TanStack Query options
 * @returns Query result with pickup tomorrow offers
 *
 * @example
 * const { data: pickupTomorrowOffers, isLoading } = usePickupTomorrowOffers(20, { latitude: 36.8, longitude: 10.2 }, { establishmentTypes: ['BAKERY'] });
 */
export function usePickupTomorrowOffers(
  limit: number = 20,
  userLocation?: { latitude: number; longitude: number },
  filters?: Pick<OfferSearchParams, 'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'>,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  const tomorrowStr = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Africa/Tunis',
  });
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.pickupTomorrow(limit, tomorrowStr), userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching pickup tomorrow offers', { limit, userLocation, filters });
      const offers = await offersService.getPickupTomorrowOffers(limit, userLocation, signal);
      const validOffers = applyClientSideFilters(offers, filters);
      Logger.info('Pickup tomorrow offers fetched and filtered', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes (time-sensitive)
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

// ============================================================================
// Prefetch Utilities
// ============================================================================

/**
 * Returns a stable callback that prefetches an offer into the TanStack cache.
 * Call on tap (before navigation.navigate) so data is ready when the screen mounts.
 *
 * Usage:
 *   const prefetchOffer = usePrefetchOffer();
 *   const handlePress = (offerId) => { prefetchOffer(offerId); navigation.navigate('OfferDetails', { offerId }); }
 */
export function usePrefetchOffer() {
  const queryClient = useQueryClient();
  return useCallback(
    (offerId: string) => {
      void queryClient.prefetchQuery({
        queryKey: offerKeys.detail(offerId),
        queryFn: () => offersService.getOfferById(offerId),
        staleTime: 1000 * 60 * 5, // Matches useOffer — skip refetch if already fresh
      });
    },
    [queryClient],
  );
}
