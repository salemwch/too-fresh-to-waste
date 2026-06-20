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
