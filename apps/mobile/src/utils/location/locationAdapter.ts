/**
 * Location Adapter
 *
 * Normalizes location data from different sources (LOCAL JSON, GOOGLE Places API)
 * into the unified ILocationResult interface.
 *
 * This ensures the UI layer receives consistent data regardless of source.
 *
 * @module LocationAdapter
 */

import type {
  ILocationResult,
  TunisianCity,
  TunisianDelegation,
  GooglePlaceResult,
} from '@/types/location.types';

/**
 * LocationAdapter class
 *
 * Provides static methods to map different data sources to ILocationResult.
 * Handles edge cases, fallbacks, and data validation.
 */
export class LocationAdapter {
  /**
   * Convert a Tunisian delegation to ILocationResult
   *
   * @param delegation - Raw delegation data from JSON
   * @param city - Parent city data for context
   * @returns Normalized location result
   */
  static fromTunisianDelegation(
    delegation: TunisianDelegation,
    city: TunisianCity,
  ): ILocationResult {
    // ✅ BEST PRACTICE: Generate unique ID using Name (not just Value)
    // This prevents duplicate keys when delegations have same Value + PostalCode
    // Example: "EL MENZAH (Zone 1)" vs "EL MENZAH (Zone 2)" - same Value, different Names
    const sanitizedName = delegation.Name.replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueId = `LOCAL_${city.Value}_${sanitizedName}_${delegation.PostalCode}`;

    return {
      id: uniqueId,
      name: delegation.Name,
      nameAr: delegation.NameAr || delegation.Name, // Fallback to Latin if Arabic missing
      subtext: `${city.Name}, Tunisia`, // e.g., "TUNIS, Tunisia"
      coords: {
        lat: delegation.Latitude,
        lng: delegation.Longitude,
      },
      source: 'LOCAL',
      postalCode: delegation.PostalCode,
    };
  }

  /**
   * Convert a Tunisian city to ILocationResult
   *
   * For city-level results (when user searches for a city name directly).
   * Uses the first delegation's coordinates as city center.
   *
   * @param city - Raw city data from JSON
   * @returns Normalized location result
   */
  static fromTunisianCity(city: TunisianCity): ILocationResult | null {
    if (city.Delegations.length === 0) {
      return null;
    }

    // Use first delegation's coordinates as city center
    // (In production, you might calculate the actual centroid)
    // length === 0 already guarded above, so [0] is safe
    const centerDelegation = city.Delegations[0]!;

    return {
      id: `LOCAL_${city.Value}_CITY`,
      name: city.Name,
      nameAr: city.NameAr || city.Name,
      subtext: 'Tunisia',
      coords: {
        lat: centerDelegation.Latitude,
        lng: centerDelegation.Longitude,
      },
      source: 'LOCAL',
    };
  }

  /**
   * Convert Google Places API result to ILocationResult
   *
   * Extracts relevant fields and maps to our unified interface.
   * Handles missing Arabic names by using the primary name.
   *
   * @param place - Raw Google Place result
   * @returns Normalized location result
   */
  static fromGooglePlace(place: GooglePlaceResult): ILocationResult {
    // Extract city name from address components (if available)
    const cityComponent = place.address_components?.find(
      component =>
        component.types.includes('locality') ||
        component.types.includes('administrative_area_level_2'),
    );

    const subtext = cityComponent ? `${cityComponent.long_name}, Tunisia` : place.formatted_address;

    return {
      id: `GOOGLE_${place.place_id}`,
      name: place.name || place.formatted_address,
      nameAr: place.name || place.formatted_address, // Google doesn't provide Arabic names directly
      subtext,
      coords: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
      source: 'GOOGLE',
      formattedAddress: place.formatted_address,
    };
  }

  /**
   * Check if two locations are duplicates based on proximity
   *
   * Two locations are considered duplicates if they are within
   * DUPLICATE_THRESHOLD_METERS of each other.
   *
   * @param a - First location
   * @param b - Second location
   * @returns True if locations are duplicates
   */
  static isDuplicate(a: ILocationResult, b: ILocationResult): boolean {
    const DUPLICATE_THRESHOLD_METERS = 100; // 100 meters

    const distance = this.calculateDistance(a.coords, b.coords);
    return distance < DUPLICATE_THRESHOLD_METERS;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   *
   * @param coord1 - First coordinate
   * @param coord2 - Second coordinate
   * @returns Distance in meters
   */
  private static calculateDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number },
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if two locations are fuzzy name matches
   *
   * Compares normalized names to detect duplicates.
   *
   * @param a - First location
   * @param b - Second location
   * @returns True if names match after normalization
   */
  static isFuzzyNameMatch(a: ILocationResult, b: ILocationResult): boolean {
    const normalize = (str: string): string =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]/g, '') // Keep Latin and Arabic chars
        .trim();

    const nameA = normalize(a.name);
    const nameB = normalize(b.name);
    const nameArA = normalize(a.nameAr);
    const nameArB = normalize(b.nameAr);

    return nameA === nameB || nameArA === nameArB || nameA === nameArB || nameArA === nameB;
  }

  /**
   * Remove duplicate locations from a merged result set
   *
   * Priority: LOCAL results are kept over GOOGLE results when duplicates found.
   *
   * @param locations - Array of location results (potentially with duplicates)
   * @returns Deduplicated array
   */
  static removeDuplicates(locations: ILocationResult[]): ILocationResult[] {
    const seen = new Set<string>();
    const result: ILocationResult[] = [];

    // Sort to prioritize LOCAL over GOOGLE
    const sorted = [...locations].sort((a, b) => {
      if (a.source === 'LOCAL' && b.source === 'GOOGLE') return -1;
      if (a.source === 'GOOGLE' && b.source === 'LOCAL') return 1;
      return 0;
    });

    for (const location of sorted) {
      // Check for exact ID match
      if (seen.has(location.id)) {
        continue;
      }

      // Check for coordinate-based duplicates
      const isDuplicateCoords = result.some(existing => this.isDuplicate(existing, location));

      // Check for fuzzy name match
      const isDuplicateName = result.some(existing => this.isFuzzyNameMatch(existing, location));

      if (!isDuplicateCoords && !isDuplicateName) {
        result.push(location);
        seen.add(location.id);
      }
    }

    return result;
  }
}
