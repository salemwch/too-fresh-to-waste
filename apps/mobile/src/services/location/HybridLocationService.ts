/**
 * Hybrid Location Service
 *
 * Orchestrates the Local-First, Hybrid search strategy:
 * 1. Search local JSON first (fast, instant results)
 * 2. If local results < threshold, call Google Places Autocomplete via backend proxy
 * 3. Merge results and remove duplicates
 *
 * Cost Optimization:
 * - Uses session tokens with Google Places API
 * - Autocomplete requests with session token are FREE
 * - Only Place Details (on selection) is billed
 * - Local-first strategy minimizes remote calls
 *
 * @module HybridLocationService
 */

import { LocationAdapter } from '@/utils/location/locationAdapter';
import { Logger } from '@/utils/logger';

import { localLocationService } from './LocalLocationService';
import { remoteLocationService } from './RemoteLocationService';

import type { ILocationResult, LocationCoords } from '@/types/location.types';

/**
 * Hybrid search configuration
 */
interface HybridSearchConfig {
  /** Minimum local results before triggering remote search (default: 3) */
  minLocalResults?: number;
  /** Maximum total results to return (default: 10) */
  maxResults?: number;
  /** Whether to enable remote fallback (default: true) */
  enableRemoteFallback?: boolean;
  /** Session token for Google Places API billing optimization */
  sessionToken?: string;
  /** User coordinates for geo-ranking (nearest results first) */
  userCoords?: LocationCoords;
}

/**
 * HybridLocationService - Combines local and remote location searches
 */
class HybridLocationService {
  private readonly DEFAULT_MIN_LOCAL_RESULTS = 3;
  private readonly DEFAULT_MAX_RESULTS = 10;

  /**
   * Search for locations using hybrid strategy
   *
   * Flow:
   * 1. User types input -> Debounced (handled by caller)
   * 2. Step A (Local): Filter JSON instantly
   * 3. Step B (Remote Fallback): If local results < threshold, call backend autocomplete
   * 4. Step C (Merge): Combine and deduplicate results
   *
   * Remote results from Google will have googlePlaceId set and placeholder coords.
   * Real coordinates are fetched only when the user selects a Google result
   * via resolveGooglePlace().
   *
   * @param query - Search query
   * @param config - Search configuration
   * @returns Promise resolving to deduplicated ILocationResult[]
   */
  async search(query: string, config: HybridSearchConfig = {}): Promise<ILocationResult[]> {
    const {
      minLocalResults = this.DEFAULT_MIN_LOCAL_RESULTS,
      maxResults = this.DEFAULT_MAX_RESULTS,
      enableRemoteFallback = true,
      sessionToken,
      userCoords,
    } = config;

    try {
      Logger.debug(`HybridLocationService: Searching for "${query}"`);

      if (!query || query.trim().length < 2) {
        return [];
      }

      // STEP A: Local search (instant, no network) — geo-ranked when coords available
      const localResults = localLocationService.search(query, maxResults, userCoords);

      Logger.debug(`HybridLocationService: Local search returned ${localResults.length} results`);

      // Check if we have enough local results
      const hasExactMatch = this.hasExactMatch(localResults, query);
      const needsRemoteFallback =
        enableRemoteFallback && (localResults.length < minLocalResults || !hasExactMatch);

      if (!needsRemoteFallback) {
        Logger.info(
          `HybridLocationService: Sufficient local results (${localResults.length}), skipping remote`,
        );
        return localResults;
      }

      // STEP B: Remote autocomplete (Google Places API via backend)
      // With session token, these autocomplete requests are FREE
      Logger.info(
        `HybridLocationService: Insufficient local results (${localResults.length}), fetching remote autocomplete...`,
      );

      let remoteResults: ILocationResult[];
      // Always request at least 3 from Google — fuzzy local noise must not zero this out
      const remoteLimit = Math.max(3, maxResults - localResults.length);

      if (sessionToken) {
        // Cost-optimized path: autocomplete only (no place details per keystroke)
        remoteResults = await remoteLocationService.autocomplete(query, sessionToken, remoteLimit);
      } else {
        // Legacy fallback: full search (autocomplete + details per keystroke)
        remoteResults = await remoteLocationService.searchLocations(query, remoteLimit);
      }

      Logger.debug(`HybridLocationService: Remote search returned ${remoteResults.length} results`);

      // STEP C: Merge and deduplicate
      const mergedResults = this.mergeResults(localResults, remoteResults, maxResults);

      Logger.info(
        `HybridLocationService: Final results: ${mergedResults.length} (${localResults.length} local + ${remoteResults.length} remote, deduplicated)`,
      );

      return mergedResults;
    } catch (error) {
      Logger.error('HybridLocationService: Search failed', { query }, error as Error);
      // Fallback to local results on error
      return localLocationService.search(query, maxResults);
    }
  }

  /**
   * Resolve full details (coordinates) for a Google Place.
   *
   * Call this when the user selects a result with source === 'GOOGLE'.
   * This concludes the session token billing session.
   *
   * @param googlePlaceId - Google Place ID from the selected result
   * @param sessionToken - Same session token used during autocomplete
   * @returns ILocationResult with real coordinates, or null
   */
  async resolveGooglePlace(
    googlePlaceId: string,
    sessionToken: string,
  ): Promise<ILocationResult | null> {
    try {
      Logger.debug(`HybridLocationService: Resolving Google place ${googlePlaceId}`);

      const details = await remoteLocationService.getPlaceDetails(googlePlaceId, sessionToken);

      if (!details) {
        Logger.warn(`HybridLocationService: Failed to resolve Google place ${googlePlaceId}`);
        return null;
      }

      Logger.info(
        `HybridLocationService: Resolved "${details.name}" at (${details.coords.lat}, ${details.coords.lng})`,
      );

      return details;
    } catch (error) {
      Logger.error(
        'HybridLocationService: resolveGooglePlace failed',
        { googlePlaceId },
        error as Error,
      );
      return null;
    }
  }

  /**
   * Check if local results contain an exact match for the query
   */
  private hasExactMatch(results: ILocationResult[], query: string): boolean {
    const normalizedQuery = this.normalizeText(query);

    return results.some(result => {
      const normalizedName = this.normalizeText(result.name);
      const normalizedNameAr = this.normalizeText(result.nameAr);

      return (
        normalizedName.startsWith(normalizedQuery) || normalizedNameAr.startsWith(normalizedQuery)
      );
    });
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Merge local and remote results, remove duplicates, and limit total
   *
   * Priority: LOCAL results are kept over GOOGLE results when duplicates detected.
   */
  private mergeResults(
    localResults: ILocationResult[],
    remoteResults: ILocationResult[],
    maxResults: number,
  ): ILocationResult[] {
    const safeLocalResults = Array.isArray(localResults) ? localResults : [];
    const safeRemoteResults = Array.isArray(remoteResults) ? remoteResults : [];

    const combined = [...safeLocalResults, ...safeRemoteResults];
    const deduplicated = LocationAdapter.removeDuplicates(combined);

    return deduplicated.slice(0, maxResults);
  }
}

// Export singleton instance
export const hybridLocationService = new HybridLocationService();
