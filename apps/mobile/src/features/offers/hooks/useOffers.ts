/**
 * Offers Hooks
 *
 * TanStack Query hooks for fetching and mutating offers data.
 * Provides caching, automatic refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import axios from 'axios';

import { Logger } from '@/utils/logger';

import { offersService } from '../services/offersService';

import type { NearbyOffersParams } from '../services/offersService';
import type { Offer, OfferListItem, OfferSearchParams, OffersResponse } from '../types/offer.types';

// ============================================================================
// Query Keys (for cache management)
// ============================================================================

const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (filters: OfferSearchParams) => [...offerKeys.lists(), filters] as const,
  details: () => [...offerKeys.all, 'detail'] as const,
  detail: (id: string) => [...offerKeys.details(), id] as const,
  featured: (limit: number) => [...offerKeys.all, 'featured', limit] as const,
  recommended: (limit: number) => [...offerKeys.all, 'recommended', limit] as const,
  nearby: (params: NearbyOffersParams) => [...offerKeys.all, 'nearby', params] as const,
  establishment: (id: string, page: number, limit: number) =>
    [...offerKeys.all, 'establishment', id, page, limit] as const,
  pickupToday: (limit: number) => [...offerKeys.all, 'pickup-today', limit] as const,
  pickupTomorrow: (limit: number) => [...offerKeys.all, 'pickup-tomorrow', limit] as const,
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
 * Fetch featured offers with optional filters
 *
 * @param limit - Maximum number of featured offers (default 10)
 * @param userLocation - Optional user location for distance calculation
 * @param filters - Optional filter parameters (establishment type, cuisine, categories, offer type)
 * @param options - TanStack Query options
 * @returns Query result with featured offers
 *
 * @example
 * const { data: featuredOffers, isLoading } = useFeaturedOffers(5, coordinates, { establishmentTypes: ['BAKERY', 'CAFE'] });
 */
export function useFeaturedOffers(
  limit: number = 10,
  userLocation?: { latitude: number; longitude: number },
  filters?: Pick<OfferSearchParams, 'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories'>,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.featured(limit), userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching featured offers', { limit, userLocation, filters });

      // Use getAllOffers with isFeatured flag + filters for proper backend filtering
      const response = await offersService.getAllOffers(
        {
          limit,
          isFeatured: true,
          ...filters,
        },
        userLocation,
        signal,
      );

      const validOffers = Array.isArray(response?.data) ? response.data : [];
      Logger.info('Featured offers fetched', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes (urgent offers)
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
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
      let validOffers = Array.isArray(offers) ? offers : [];

      // Apply filters client-side
      if (filters !== undefined) {
        if (filters.type !== undefined) {
          validOffers = validOffers.filter((offer) => offer.type === filters.type);
        }
        const categories = filters.categories;
        if (Array.isArray(categories) && categories.length > 0) {
          validOffers = validOffers.filter((offer) =>
            categories.some((cat) => (offer.categories ?? []).includes(cat)),
          );
        }
        // Note: establishmentTypes and cuisineTypes filtering requires establishment data
        // which may not be fully populated. Log warning if attempted.
        if (
          (Array.isArray(filters.establishmentTypes) && filters.establishmentTypes.length > 0) ||
          (Array.isArray(filters.cuisineTypes) && filters.cuisineTypes.length > 0)
        ) {
          Logger.warn(
            'Establishment/cuisine filtering not fully supported for urgent offers - use general search instead',
          );
        }
      }

      Logger.info('Urgent offers fetched and filtered', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 1, // Consider data fresh for 1 minute (very time-sensitive)
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes only
    ...options,
  });
}

/**
 * Fetch personalized recommended offers (requires authentication)
 * Based on user's favorited establishments and categories
 *
 * Returns empty array if user is not authenticated (graceful fallback)
 *
 * @param limit - Maximum number of offers (default 20)
 * @param userLocation - Optional user location for distance calculation
 * @param options - TanStack Query options
 * @returns Query result with recommended offers
 *
 * @example
 * const { data: recommended, isLoading } = useRecommendedOffers(10, { latitude: 36.8, longitude: 10.2 });
 */
export function useRecommendedOffers(
  limit: number = 20,
  userLocation?: { latitude: number; longitude: number },
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.recommended(limit), userLocation],
    queryFn: async ({ signal }) => {
      try {
        Logger.info('Fetching recommended offers', { limit, hasLocation: !!userLocation });
        const offers = await offersService.getRecommendedOffers(limit, userLocation, signal);
        const validOffers = Array.isArray(offers) ? offers : [];
        Logger.info('Recommended offers fetched', { count: validOffers.length });
        return validOffers;
      } catch (error: unknown) {
        // Re-throw cancellation errors for TanStack Query
        if (axios.isAxiosError(error)) {
          if (
            axios.isCancel(error) ||
            error.code === 'ERR_CANCELED' ||
            error.message === 'canceled'
          ) {
            throw error;
          }
        }

        // Graceful fallback on auth errors (token expired mid-request)
        if (error instanceof Error && error.message.includes('Authentication')) {
          Logger.warn('Authentication error fetching recommended offers, returning empty array', {
            error: error.message,
          });
          return [];
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: false, // Don't retry on authentication errors
    ...options,
  });
}

/**
 * Fetch offers near a location
 *
 * @param params - Location parameters
 * @param options - TanStack Query options
 * @returns Query result with nearby offers
 *
 * @example
 * const { data: nearbyOffers } = useNearbyOffers({
 *   latitude: 36.8065,
 *   longitude: 10.1815,
 *   maxDistance: 5000,
 *   limit: 20
 * });
 */
export function useNearbyOffersQuery(
  params: NearbyOffersParams,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OfferListItem[], Error>({
    queryKey: offerKeys.nearby(params),
    queryFn: async ({ signal }) => {
      Logger.info('Fetching nearby offers', { params });
      const offers = await offersService.getNearbyOffers(params, signal);
      // Handle undefined or null responses
      const validOffers = Array.isArray(offers) ? offers : [];
      Logger.info('Nearby offers fetched', { count: validOffers.length });
      return validOffers;
    },
    enabled: !!(params.latitude && params.longitude),
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

/**
 * Fetch offers by establishment
 *
 * @param establishmentId - Establishment ID
 * @param page - Page number
 * @param limit - Items per page
 * @param options - TanStack Query options
 * @returns Query result with establishment offers
 */
export function useEstablishmentOffers(
  establishmentId: string,
  page: number = 1,
  limit: number = 10,
  options?: Omit<UseQueryOptions<OffersResponse, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OffersResponse, Error>({
    queryKey: offerKeys.establishment(establishmentId, page, limit),
    queryFn: async ({ signal }) => {
      Logger.info('Fetching establishment offers', { establishmentId, page, limit });
      const response = await offersService.getOffersByEstablishment(
        establishmentId,
        page,
        limit,
        signal,
      );
      // Handle undefined or malformed responses
      const validResponse = response ?? {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
      Logger.info('Establishment offers fetched', { total: validResponse.meta?.total });
      return validResponse;
    },
    enabled: !!establishmentId,
    staleTime: 1000 * 60 * 3, // Consider data fresh for 3 minutes
    gcTime: 1000 * 60 * 20, // Keep in cache for 20 minutes
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
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.pickupToday(limit), userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching pickup today offers', { limit, userLocation, filters });
      const offers = await offersService.getPickupTodayOffers(limit, userLocation, signal);
      let validOffers = Array.isArray(offers) ? offers : [];

      // Apply filters client-side
      if (filters !== undefined) {
        if (filters.type !== undefined) {
          validOffers = validOffers.filter((offer) => offer.type === filters.type);
        }
        const categories = filters.categories;
        if (Array.isArray(categories) && categories.length > 0) {
          validOffers = validOffers.filter((offer) =>
            categories.some((cat) => (offer.categories ?? []).includes(cat)),
          );
        }
        // Note: establishmentTypes and cuisineTypes filtering requires establishment data
        // which may not be fully populated in OfferListItem. Log warning if attempted.
        if (
          (Array.isArray(filters.establishmentTypes) && filters.establishmentTypes.length > 0) ||
          (Array.isArray(filters.cuisineTypes) && filters.cuisineTypes.length > 0)
        ) {
          Logger.warn(
            'Establishment/cuisine filtering not fully supported for pickup endpoints - use general search instead',
          );
        }
      }

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
  return useQuery<OfferListItem[], Error>({
    queryKey: [...offerKeys.pickupTomorrow(limit), userLocation, filters],
    queryFn: async ({ signal }) => {
      Logger.info('Fetching pickup tomorrow offers', { limit, userLocation, filters });
      const offers = await offersService.getPickupTomorrowOffers(limit, userLocation, signal);
      let validOffers = Array.isArray(offers) ? offers : [];

      // Apply filters client-side
      if (filters !== undefined) {
        if (filters.type !== undefined) {
          validOffers = validOffers.filter((offer) => offer.type === filters.type);
        }
        const categories = filters.categories;
        if (Array.isArray(categories) && categories.length > 0) {
          validOffers = validOffers.filter((offer) =>
            categories.some((cat) => (offer.categories ?? []).includes(cat)),
          );
        }
        // Note: establishmentTypes and cuisineTypes filtering requires establishment data
        // which may not be fully populated in OfferListItem. Log warning if attempted.
        if (
          (Array.isArray(filters.establishmentTypes) && filters.establishmentTypes.length > 0) ||
          (Array.isArray(filters.cuisineTypes) && filters.cuisineTypes.length > 0)
        ) {
          Logger.warn(
            'Establishment/cuisine filtering not fully supported for pickup endpoints - use general search instead',
          );
        }
      }

      Logger.info('Pickup tomorrow offers fetched and filtered', { count: validOffers.length });
      return validOffers;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes (time-sensitive)
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks (Consumer Actions - require authentication)
// ============================================================================

/**
 * Reserve quantity from an offer
 */
export function useReserveOffer(offerId: string) {
  const queryClient = useQueryClient();

  return useMutation<Offer, Error, number>({
    mutationFn: async (quantity: number) => {
      Logger.info('Reserving offer', { offerId, quantity });
      const offer = await offersService.reserveQuantity(offerId, quantity);
      Logger.info('Offer reserved successfully', { offerId, quantity });
      return offer;
    },
    onSuccess: (updatedOffer) => {
      queryClient.setQueryData(offerKeys.detail(offerId), updatedOffer);
      void queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}
