/**
 * Remote Location Service
 *
 * Calls the backend Google Places API proxy for location searches.
 * This is the SECONDARY/FALLBACK source when local search returns insufficient results.
 *
 * Features:
 * - Cost-optimized: uses autocomplete + details split with session tokens
 * - Autocomplete requests with session token are FREE (Google billing)
 * - Only the Place Details call (on user selection) is billed
 * - Handles errors and network issues gracefully
 *
 * Endpoints:
 * - GET /geolocation/location/autocomplete - predictions without coords (per keystroke)
 * - GET /geolocation/location/details - full details with coords (on selection)
 *
 * @module RemoteLocationService
 */

import axios, { type AxiosError } from 'axios';

import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';
import type { ILocationResult } from '@/types/location.types';

/**
 * Backend autocomplete suggestion shape (no coords)
 */
interface AutocompleteSuggestion {
  id: string;
  name: string;
  nameAr: string;
  subtext: string;
  source: 'GOOGLE';
  googlePlaceId: string;
}

/**
 * RemoteLocationService - Handles remote location searches via backend proxy
 */
export class RemoteLocationService {
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor() {
    this.baseURL = environment.api.baseUrl;
    this.timeout = environment.api.timeout;
  }

  /**
   * Get autocomplete suggestions (no coordinates).
   *
   * When used with a session token, these requests are FREE in Google billing.
   * The session token groups all autocomplete calls until a Place Details call
   * concludes the session.
   *
   * @param query - Search query (e.g., "Tunis")
   * @param sessionToken - Session token for billing optimization
   * @param limit - Maximum results to return (default: 5)
   * @returns ILocationResult[] with placeholder coords (0, 0) and googlePlaceId set
   */
  async autocomplete(
    query: string,
    sessionToken: string,
    limit: number = 5,
  ): Promise<ILocationResult[]> {
    try {
      Logger.debug(
        `RemoteLocationService: Autocomplete "${query}" (session: active)`,
      );

      if (!query || query.trim().length < 2) {
        return [];
      }

      const url = `${this.baseURL}/geolocation/location/autocomplete`;
      const params = {
        query: query.trim(),
        sessionToken,
        limit,
      };

      const response = await axios.get<AutocompleteSuggestion[]>(url, {
        params,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const suggestions = Array.isArray(response.data) ? response.data : [];

      // Map suggestions to ILocationResult with placeholder coords
      const results: ILocationResult[] = suggestions.map(suggestion => ({
        id: suggestion.id,
        name: suggestion.name,
        nameAr: suggestion.nameAr,
        subtext: suggestion.subtext,
        coords: { lat: 0, lng: 0 }, // Placeholder until user selects
        source: suggestion.source,
        googlePlaceId: suggestion.googlePlaceId,
      }));

      Logger.info(
        `RemoteLocationService: Autocomplete found ${results.length} results for "${query}"`,
      );

      return results;
    } catch (error) {
      this.handleError(error, query);
      return [];
    }
  }

  /**
   * Get full place details (with coordinates) for a specific Google Place ID.
   *
   * This call concludes the session token billing session.
   * After this call, the session token should be discarded.
   *
   * @param placeId - Google Place ID
   * @param sessionToken - Same session token used in autocomplete requests
   * @returns ILocationResult with real coordinates, or null
   */
  async getPlaceDetails(
    placeId: string,
    sessionToken: string,
  ): Promise<ILocationResult | null> {
    try {
      Logger.debug(
        `RemoteLocationService: Fetching details for ${placeId} (session: concluding)`,
      );

      if (!placeId) {
        return null;
      }

      const url = `${this.baseURL}/geolocation/location/details`;
      const params = {
        placeId,
        sessionToken,
      };

      const response = await axios.get<ILocationResult>(url, {
        params,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.data) {
        Logger.warn(
          `RemoteLocationService: No details found for placeId ${placeId}`,
        );
        return null;
      }

      Logger.info(
        `RemoteLocationService: Details resolved for "${response.data.name}"`,
      );

      return response.data;
    } catch (error) {
      this.handleError(error, placeId);
      return null;
    }
  }

  /**
   * Search for locations using backend Google Places API proxy (legacy).
   *
   * @deprecated Use autocomplete() + getPlaceDetails() with session tokens instead.
   *
   * @param query - Search query (e.g., "Tunis")
   * @param limit - Maximum results to return (default: 5)
   * @returns Promise resolving to ILocationResult[]
   */
  async searchLocations(query: string, limit: number = 5): Promise<ILocationResult[]> {
    try {
      Logger.debug(`RemoteLocationService: Searching for "${query}" (legacy)`);

      if (!query || query.trim().length < 2) {
        return [];
      }

      const url = `${this.baseURL}/geolocation/location/search`;
      const params = {
        query: query.trim(),
        limit,
      };

      const response = await axios.get<ILocationResult[]>(url, {
        params,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const results = Array.isArray(response.data) ? response.data : [];

      Logger.info(
        `RemoteLocationService: Found ${results.length} results for "${query}"`,
      );

      return results;
    } catch (error) {
      this.handleError(error, query);
      return [];
    }
  }

  /**
   * Handle errors from remote API calls
   */
  private handleError(error: unknown, context: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNABORTED') {
        Logger.warn(`RemoteLocationService: Request timeout for "${context}"`);
      } else if (axiosError.response) {
        Logger.error(
          `RemoteLocationService: API error ${axiosError.response.status} for "${context}"`,
          { status: axiosError.response.status },
          new Error(axiosError.message),
        );
      } else if (axiosError.request) {
        Logger.error(
          `RemoteLocationService: Network error for "${context}"`,
          {},
          new Error('No response received'),
        );
      }
    } else {
      Logger.error(
        `RemoteLocationService: Unknown error for "${context}"`,
        {},
        error as Error,
      );
    }
  }
}

// Export singleton instance
export const remoteLocationService = new RemoteLocationService();
