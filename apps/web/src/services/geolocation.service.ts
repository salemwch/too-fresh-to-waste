import { apiClient } from '@/lib/api-client';
import type { PlaceSuggestion, PlaceDetails } from '@/types/geolocation';

const GEO_BASE = '/geolocation';
const EST_BASE = '/establishments';

export const geolocationService = {
  /**
   * Search for places via autocomplete (Tunisia only).
   * FREE when used with session tokens.
   *
   * @param signal - Optional AbortSignal to cancel in-flight requests
   */
  autocomplete(query: string, sessionToken: string, limit = 5, signal?: AbortSignal) {
    return apiClient.get<{ data: PlaceSuggestion[] }>(
      `${GEO_BASE}/location/autocomplete`,
      { params: { query, sessionToken, limit }, ...(signal ? { signal } : {}) },
    );
  },

  /**
   * Get full place details by Google Place ID.
   * Concludes the session token (billed as Essentials SKU).
   */
  getPlaceDetails(placeId: string, sessionToken: string) {
    return apiClient.get<{ data: PlaceDetails }>(
      `${GEO_BASE}/location/details`,
      { params: { placeId, sessionToken } },
    );
  },

  /**
   * Check whether a Google Place ID is already claimed by an active,
   * admin-approved establishment.  Public — no auth required.
   */
  checkPlaceAvailability(googlePlaceId: string) {
    return apiClient.get<{ data: { available: boolean; message?: string } }>(
      `${EST_BASE}/check-place/${encodeURIComponent(googlePlaceId)}`,
    );
  },
};
