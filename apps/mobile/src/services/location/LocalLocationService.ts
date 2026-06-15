/**
 * Local Location Service (Singleton)
 *
 * Loads tunisian-cities.json into memory on app initialization and provides
 * fast, case-insensitive search functionality.
 *
 * This is the PRIMARY source for location data (Local-First strategy).
 *
 * Features:
 * - Singleton pattern (single in-memory instance)
 * - Normalized search (case-insensitive, diacritic-insensitive)
 * - Search on both Latin (Name) and Arabic (NameAr) fields
 * - Returns unified ILocationResult[]
 *
 * @module LocalLocationService
 */

import tunisianCitiesData from '@/assets/data/tunisian-cities.json';
import { LocationAdapter } from '@/utils/location/locationAdapter';
import { Logger } from '@/utils/logger';

import type {
  ILocationResult,
  LocationCoords,
  TunisianCity,
  TunisianDelegation,
} from '@/types/location.types';

/**
 * Flattened searchable location entry
 * Pre-computed for faster search performance
 */
interface SearchableLocation {
  /** Original delegation data */
  delegation: TunisianDelegation;
  /** Parent city data */
  city: TunisianCity;
  /** Normalized search text (Latin) */
  searchTextLatin: string;
  /** Normalized search text (Arabic) */
  searchTextArabic: string;
  /** Converted to ILocationResult */
  result: ILocationResult;
}

/**
 * LocalLocationService - Singleton class for local location search
 */
class LocalLocationService {
  private static instance: LocalLocationService | null = null;

  private searchableLocations: SearchableLocation[] = [];
  private isInitialized: boolean = false;

  /**
   * Private constructor (Singleton pattern)
   */
  private constructor() {
    // Private to prevent direct instantiation
  }

  /**
   * Get singleton instance
   *
   * @returns The singleton instance
   */
  static getInstance(): LocalLocationService {
    LocalLocationService.instance ??= new LocalLocationService();
    return LocalLocationService.instance;
  }

  /**
   * Initialize the service by loading and indexing tunisian-cities.json
   *
   * This should be called once on app startup (e.g., in App.tsx).
   * Subsequent calls are no-ops.
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void> {
    if (this.isInitialized) {
      Logger.debug('LocalLocationService already initialized');
      return Promise.resolve();
    }

    try {
      Logger.info('Initializing LocalLocationService...');

      const cities = tunisianCitiesData as TunisianCity[];

      // Flatten and index all delegations for fast search
      this.searchableLocations = [];

      for (const city of cities) {
        for (const delegation of city.Delegations) {
          const result = LocationAdapter.fromTunisianDelegation(delegation, city);

          this.searchableLocations.push({
            delegation,
            city,
            searchTextLatin: this.normalizeText(delegation.Name),
            searchTextArabic: this.normalizeText(delegation.NameAr),
            result,
          });
        }
      }

      this.isInitialized = true;
      Logger.info(
        `LocalLocationService initialized with ${this.searchableLocations.length} locations`,
      );
      return Promise.resolve();
    } catch (error) {
      Logger.error('Failed to initialize LocalLocationService', {}, error as Error);
      return Promise.reject(new Error('Failed to load local location data'));
    }
  }

  /**
   * Normalize text for case-insensitive, diacritic-insensitive search
   *
   * Handles both Latin and Arabic text.
   *
   * @param text - Raw text
   * @returns Normalized lowercase text
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD') // Decompose diacritics
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .trim();
  }

  /**
   * Search for locations matching the query
   *
   * Searches on both Name (Latin) and NameAr (Arabic) fields.
   * Returns results sorted by relevance:
   * 1. Exact matches (starts with query)
   * 2. Partial matches (contains query)
   * 3. Fuzzy matches (≤ 2 edit distance — handles typos/transpositions)
   *
   * @param query - Search query (minimum 2 characters)
   * @param maxResults - Maximum results to return (default: 10)
   * @returns Array of matching locations
   */
  search(query: string, maxResults: number = 10, userCoords?: LocationCoords): ILocationResult[] {
    if (!this.isInitialized) {
      Logger.warn('LocalLocationService.search() called before initialization');
      return [];
    }

    if (!query || query.trim().length < 2) {
      return [];
    }

    const normalizedQuery = this.normalizeText(query);
    // Tighter fuzzy: divisor 5 so short queries (< 10 chars) stay at distance 1
    const maxEditDistance = Math.max(1, Math.floor(normalizedQuery.length / 5));

    const exactMatches: SearchableLocation[] = [];
    const partialMatches: SearchableLocation[] = [];
    const fuzzyMatches: { location: SearchableLocation; distance: number }[] = [];

    for (const location of this.searchableLocations) {
      const matchesLatin = location.searchTextLatin.includes(normalizedQuery);
      const matchesArabic = location.searchTextArabic.includes(normalizedQuery);

      if (matchesLatin || matchesArabic) {
        const isExactLatin = location.searchTextLatin.startsWith(normalizedQuery);
        const isExactArabic = location.searchTextArabic.startsWith(normalizedQuery);

        if (isExactLatin || isExactArabic) {
          exactMatches.push(location);
        } else {
          partialMatches.push(location);
        }
        continue;
      }

      const bestDist = this.bestFuzzyDistance(normalizedQuery, location.searchTextLatin);
      if (bestDist <= maxEditDistance) {
        fuzzyMatches.push({ location, distance: bestDist });
      }
    }

    fuzzyMatches.sort((a, b) => a.distance - b.distance);

    // Geo-rank: within each tier, sort nearest-first when user coords available
    if (userCoords) {
      const byDistance = (a: SearchableLocation, b: SearchableLocation) =>
        this.haversineDistance(
          userCoords.lat,
          userCoords.lng,
          a.delegation.Latitude,
          a.delegation.Longitude,
        ) -
        this.haversineDistance(
          userCoords.lat,
          userCoords.lng,
          b.delegation.Latitude,
          b.delegation.Longitude,
        );

      exactMatches.sort(byDistance);
      partialMatches.sort(byDistance);
      fuzzyMatches.sort((a, b) =>
        a.distance !== b.distance
          ? a.distance - b.distance
          : this.haversineDistance(
              userCoords.lat,
              userCoords.lng,
              a.location.delegation.Latitude,
              a.location.delegation.Longitude,
            ) -
            this.haversineDistance(
              userCoords.lat,
              userCoords.lng,
              b.location.delegation.Latitude,
              b.location.delegation.Longitude,
            ),
      );
    }

    const allMatches = [...exactMatches, ...partialMatches, ...fuzzyMatches.map(m => m.location)];

    return allMatches.slice(0, maxResults).map(match => match.result);
  }

  /**
   * Best fuzzy distance between query and any word (or sliding window) in text.
   * Returns the minimum Levenshtein distance found.
   */
  private bestFuzzyDistance(query: string, text: string): number {
    const words = text.split(/[\s(),-]+/).filter(w => w.length > 0);
    let best = Infinity;

    for (const word of words) {
      if (Math.abs(word.length - query.length) > 2) continue;
      const d = this.levenshteinDistance(query, word);
      if (d < best) best = d;
      if (best === 0) return 0;
    }

    // Also check if the query fuzzy-matches a substring of the full text
    if (query.length <= text.length) {
      for (let i = 0; i <= text.length - query.length + 1 && i <= text.length - 1; i++) {
        const slice = text.substring(i, i + query.length + 1);
        const d = this.levenshteinDistance(query, slice);
        if (d < best) best = d;
        if (best === 0) return 0;
      }
    }

    return best;
  }

  /**
   * Levenshtein edit distance with early termination.
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const lenA = a.length;
    const lenB = b.length;

    // Full matrix approach for strict TS compatibility
    const matrix: number[][] = [];

    for (let i = 0; i <= lenA; i++) {
      matrix[i] = new Array<number>(lenB + 1);
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= lenB; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost,
        );
      }
    }

    return matrix[lenA]![lenB]!;
  }

  /**
   * Get all cities (for dropdowns or full lists)
   *
   * @returns Array of all Tunisian cities as ILocationResult[]
   */
  getAllCities(): ILocationResult[] {
    if (!this.isInitialized) {
      Logger.warn('LocalLocationService.getAllCities() called before initialization');
      return [];
    }

    const cities = tunisianCitiesData as TunisianCity[];
    return cities
      .map(city => LocationAdapter.fromTunisianCity(city))
      .filter((result): result is ILocationResult => result !== null);
  }

  /**
   * Get delegations for a specific city
   *
   * @param cityValue - City value (e.g., "TUNIS")
   * @returns Array of delegations for the city
   */
  getDelegationsByCity(cityValue: string): ILocationResult[] {
    if (!this.isInitialized) {
      return [];
    }

    return this.searchableLocations
      .filter(loc => loc.city.Value === cityValue.toUpperCase())
      .map(loc => loc.result);
  }

  /**
   * Reverse-geocode coordinates using the local JSON.
   *
   * Finds the delegation whose representative point is closest to the given
   * coordinates and returns the human-readable locality name extracted from
   * the delegation's Name field:
   *
   *   "MSAKEN (Messadine)"        → "Messadine"
   *   "LA MARSA (Cite Essalama)"  → "Cite Essalama"
   *   "TUNIS"                     → "Tunis"
   *
   * Returns null if no delegation is found within maxRadiusKm (the caller
   * should then fall back to Geoapify).
   *
   * @param lat - Latitude of the GPS fix
   * @param lng - Longitude of the GPS fix
   * @param maxRadiusKm - Maximum search radius in km (default: 50)
   */
  findNearestLocalityName(lat: number, lng: number, maxRadiusKm: number = 50): string | null {
    if (!this.isInitialized) return null;

    let nearest: SearchableLocation | null = null;
    let nearestDistanceM = Infinity;

    for (const loc of this.searchableLocations) {
      const distM = this.haversineDistance(
        lat,
        lng,
        loc.delegation.Latitude,
        loc.delegation.Longitude,
      );
      if (distM < nearestDistanceM) {
        nearestDistanceM = distM;
        nearest = loc;
      }
    }

    if (!nearest || nearestDistanceM > maxRadiusKm * 1000) return null;

    // Extract the parenthetical locality: "MSAKEN (Messadine)" → "Messadine"
    const parenthetical = nearest.delegation.Name.match(/\(([^)]+)\)/)?.[1];
    if (parenthetical) return parenthetical;

    // No parenthetical — title-case the main delegation name
    return nearest.delegation.Name.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Check if service is initialized
   *
   * @returns True if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /** Haversine distance between two points, returns metres. */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// Export singleton instance
export const localLocationService = LocalLocationService.getInstance();
