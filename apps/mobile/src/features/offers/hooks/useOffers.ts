/**
 * Offers Hooks
 *
 * React Query hooks for fetching and mutating offers data.
 * Provides caching, automatic refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { Logger } from '@/utils/logger';
import type { RootState } from '@/types';

import { offersService } from '../services/offersService';
import type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
  CreateOfferPayload,
  UpdateOfferPayload,
  OfferStatus,
} from '../types/offer.types';
import type { NearbyOffersParams } from '../services/offersService';

// ============================================================================
// Query Keys (for cache management)
// ============================================================================

export const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (filters: OfferSearchParams) => [...offerKeys.lists(), filters] as const,
  details: () => [...offerKeys.all, 'detail'] as const,
  detail: (id: string) => [...offerKeys.details(), id] as const,
  featured: (limit: number) => [...offerKeys.all, 'featured', limit] as const,
  nearby: (params: NearbyOffersParams) => [...offerKeys.all, 'nearby', params] as const,
  establishment: (id: string, page: number, limit: number) =>
    [...offerKeys.all, 'establishment', id, page, limit] as const,
};

// ============================================================================
// Query Hooks (Data Fetching)
// ============================================================================

/**
 * Fetch single offer by ID
 *
 * @param offerId - Offer ID to fetch
 * @param options - React Query options
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
    queryFn: async () => {
      Logger.info('Fetching offer', { offerId });
      const offer = await offersService.getOfferById(offerId);

      // Debug logging to see what we got
      Logger.info('Offer fetched - full response:', {
        offerId,
        hasOffer: !!offer,
        hasPricing: !!(offer as any)?.pricing,
        offerKeys: offer ? Object.keys(offer) : [],
        pricing: (offer as any)?.pricing
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
 * @param options - React Query options
 * @returns Query result with paginated offers
 *
 * @example
 * const { data, isLoading } = useOffers({ page: 1, limit: 20, status: OfferStatus.ACTIVE });
 */
export function useOffers(
  params?: OfferSearchParams,
  options?: Omit<UseQueryOptions<OffersResponse, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OffersResponse, Error>({
    queryKey: offerKeys.list(params || {}),
    queryFn: async () => {
      Logger.info('Fetching offers', params);
      const response = await offersService.getAllOffers(params);
      Logger.info('Offers fetched successfully', {
        total: response.meta?.total,
        page: response.meta?.page,
      });
      return response;
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
    gcTime: 1000 * 60 * 15, // Keep in cache for 15 minutes
    ...options,
  });
}

/**
 * Fetch featured offers
 *
 * @param limit - Maximum number of featured offers (default 10)
 * @param options - React Query options
 * @returns Query result with featured offers
 *
 * @example
 * const { data: featuredOffers, isLoading } = useFeaturedOffers(5);
 */
export function useFeaturedOffers(
  limit: number = 10,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<OfferListItem[], Error>({
    queryKey: offerKeys.featured(limit),
    queryFn: async () => {
      Logger.info('Fetching featured offers', { limit });
      const offers = await offersService.getFeaturedOffers(limit);
      Logger.info('Featured offers fetched', { count: offers.length });
      return offers;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    ...options,
  });
}

/**
 * Fetch offers near a location
 *
 * @param params - Location parameters
 * @param options - React Query options
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
    queryFn: async () => {
      Logger.info('Fetching nearby offers', params);
      const offers = await offersService.getNearbyOffers(params);
      Logger.info('Nearby offers fetched', { count: offers.length });
      return offers;
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
 * @param options - React Query options
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
    queryFn: async () => {
      Logger.info('Fetching establishment offers', { establishmentId, page, limit });
      const response = await offersService.getOffersByEstablishment(establishmentId, page, limit);
      Logger.info('Establishment offers fetched', { total: response.meta?.total });
      return response;
    },
    enabled: !!establishmentId,
    staleTime: 1000 * 60 * 3, // Consider data fresh for 3 minutes
    gcTime: 1000 * 60 * 20, // Keep in cache for 20 minutes
    ...options,
  });
}

// ============================================================================
// Mutation Hooks (Data Modification - require authentication)
// ============================================================================

/**
 * Create a new offer
 * Requires JWT token from Redux auth state
 *
 * @example
 * const createMutation = useCreateOffer();
 * createMutation.mutate(offerData, {
 *   onSuccess: (newOffer) => console.log('Created:', newOffer.id),
 *   onError: (error) => console.error('Failed:', error.message)
 * });
 */
export function useCreateOffer() {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  return useMutation<Offer, Error, CreateOfferPayload>({
    mutationFn: async (payload: CreateOfferPayload) => {
      if (!accessToken) {
        throw new Error('Authentication required to create offer');
      }
      Logger.info('Creating offer', { title: payload.title });
      const offer = await offersService.createOffer(payload, accessToken);
      Logger.info('Offer created successfully', { offerId: offer._id });
      return offer;
    },
    onSuccess: () => {
      // Invalidate offers list to refetch
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

/**
 * Update an existing offer
 */
export function useUpdateOffer(offerId: string) {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  return useMutation<Offer, Error, UpdateOfferPayload>({
    mutationFn: async (payload: UpdateOfferPayload) => {
      if (!accessToken) {
        throw new Error('Authentication required to update offer');
      }
      Logger.info('Updating offer', { offerId });
      const offer = await offersService.updateOffer(offerId, payload, accessToken);
      Logger.info('Offer updated successfully', { offerId });
      return offer;
    },
    onSuccess: (updatedOffer) => {
      // Update cache with new data
      queryClient.setQueryData(offerKeys.detail(offerId), updatedOffer);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

/**
 * Update offer status
 */
export function useUpdateOfferStatus(offerId: string) {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  return useMutation<Offer, Error, OfferStatus>({
    mutationFn: async (status: OfferStatus) => {
      if (!accessToken) {
        throw new Error('Authentication required to update offer status');
      }
      Logger.info('Updating offer status', { offerId, status });
      const offer = await offersService.updateOfferStatus(offerId, status, accessToken);
      Logger.info('Offer status updated', { offerId, status });
      return offer;
    },
    onSuccess: (updatedOffer) => {
      queryClient.setQueryData(offerKeys.detail(offerId), updatedOffer);
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

/**
 * Reserve quantity from an offer
 */
export function useReserveOffer(offerId: string) {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  return useMutation<Offer, Error, number>({
    mutationFn: async (quantity: number) => {
      if (!accessToken) {
        throw new Error('Authentication required to reserve offer');
      }
      Logger.info('Reserving offer', { offerId, quantity });
      const offer = await offersService.reserveQuantity(offerId, quantity, accessToken);
      Logger.info('Offer reserved successfully', { offerId, quantity });
      return offer;
    },
    onSuccess: (updatedOffer) => {
      queryClient.setQueryData(offerKeys.detail(offerId), updatedOffer);
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}

/**
 * Delete an offer
 */
export function useDeleteOffer() {
  const queryClient = useQueryClient();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  return useMutation<{ status: string; message: string; offerId: string }, Error, string>({
    mutationFn: async (offerId: string) => {
      if (!accessToken) {
        throw new Error('Authentication required to delete offer');
      }
      Logger.info('Deleting offer', { offerId });
      const result = await offersService.deleteOffer(offerId, accessToken);
      Logger.info('Offer deleted successfully', { offerId });
      return result;
    },
    onSuccess: (_, offerId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: offerKeys.detail(offerId) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
  });
}
