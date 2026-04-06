/**
 * Location Data Transformers
 *
 * Centralized utilities for transforming location data between different formats.
 * Follows DRY principles - single source of truth for data transformations.
 *
 * @module LocationTransformers
 */

import type { LocationItem } from '@/navigation/components';
import type { ILocationResult } from '@/types/location.types';

const hasText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Transform ILocationResult[] to LocationItem[] (for UI components)
 *
 * This is the SINGLE source of truth for this transformation.
 * Used by both HomeScreen and SearchScreen to avoid duplication.
 *
 * @param results - Location results from hybrid search
 * @param preferArabic - Whether to prefer Arabic names (default: false)
 * @returns Transformed location items for UI
 *
 * @example
 * ```tsx
 * const locationItems = transformLocationResultsToItems(searchResults, isArabicLocale);
 * <LocationPicker items={locationItems} />
 * ```
 */
export function transformLocationResultsToItems(
  results: ILocationResult[],
  preferArabic: boolean = false,
): LocationItem[] {
  if (results.length === 0) {
    return [];
  }

  return results.map(result => {
    // Choose display name based on language preference
    const displayName = preferArabic ? result.nameAr : result.name;

    return {
      id: result.id,
      name: result.name, // Fallback (always use Latin for compatibility)
      city: displayName, // Primary display (can be Arabic or Latin)
      fullAddress: result.subtext, // Context text (e.g., "Tunis, Tunisia")
      latitude: result.coords.lat,
      longitude: result.coords.lng,
      ...(result.googlePlaceId !== undefined && { googlePlaceId: result.googlePlaceId }),
    };
  });
}

/**
 * Transform a single ILocationResult to LocationItem
 *
 * Useful for individual location selections.
 *
 * @param result - Single location result
 * @param preferArabic - Whether to prefer Arabic name
 * @returns Transformed location item
 */
export function transformLocationResultToItem(
  result: ILocationResult,
  preferArabic: boolean = false,
): LocationItem {
  const displayName = preferArabic ? result.nameAr : result.name;

  return {
    id: result.id,
    name: result.name,
    city: displayName,
    fullAddress: result.subtext,
    latitude: result.coords.lat,
    longitude: result.coords.lng,
    ...(result.googlePlaceId !== undefined && { googlePlaceId: result.googlePlaceId }),
  };
}

/**
 * Extract coordinates from LocationItem (with null safety)
 *
 * @param item - Location item
 * @returns Coordinates object or null if missing
 */
export function extractCoordinatesFromLocationItem(
  item: LocationItem,
): { latitude: number; longitude: number } | null {
  if (item.latitude === undefined || item.longitude === undefined) {
    return null;
  }

  return {
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

/**
 * Get display name from LocationItem (with fallbacks)
 *
 * Priority: city → name → "Unknown Location"
 *
 * @param item - Location item
 * @returns Display name
 */
export function getLocationDisplayName(item: LocationItem): string {
  if (hasText(item.city)) {
    return item.city;
  }

  if (hasText(item.name)) {
    return item.name;
  }

  return 'Unknown Location';
}

/**
 * Get full address from LocationItem (with fallbacks)
 *
 * Priority: fullAddress → city → name → "Unknown Location"
 *
 * @param item - Location item
 * @returns Full address string
 */
export function getLocationFullAddress(item: LocationItem): string {
  if (hasText(item.fullAddress)) {
    return item.fullAddress;
  }

  if (hasText(item.city)) {
    return item.city;
  }

  if (hasText(item.name)) {
    return item.name;
  }

  return 'Unknown Location';
}
