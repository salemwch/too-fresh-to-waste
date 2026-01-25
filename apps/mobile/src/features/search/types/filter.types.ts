/**
 * Filter Types
 *
 * Type definitions for search filters
 */

import type { EstablishmentType, OfferType } from '@/features/offers/types/offer.types';

/**
 * Complete filter state
 */
export interface FilterState {
  offerType: OfferType | null;
  establishmentTypes: EstablishmentType[];
  cuisineTypes: string[];
  categories: string[];
  priceRange: {
    min: number | null;
    max: number | null;
  };
  minDiscount: number | null;
}

/**
 * Initial/empty filter state
 */
export const INITIAL_FILTER_STATE: FilterState = {
  offerType: null,
  establishmentTypes: [],
  cuisineTypes: [],
  categories: [],
  priceRange: {
    min: null,
    max: null,
  },
  minDiscount: null,
};

/**
 * Check if filters are active (not empty)
 */
export const hasActiveFilters = (filters: FilterState): boolean => {
  return (
    filters.offerType !== null ||
    filters.establishmentTypes.length > 0 ||
    filters.cuisineTypes.length > 0 ||
    filters.categories.length > 0 ||
    filters.priceRange.min !== null ||
    filters.priceRange.max !== null ||
    filters.minDiscount !== null
  );
};

/**
 * Count active filters
 */
export const countActiveFilters = (filters: FilterState): number => {
  let count = 0;
  if (filters.offerType !== null) count++;
  if (filters.establishmentTypes.length > 0) count++;
  if (filters.cuisineTypes.length > 0) count++;
  if (filters.categories.length > 0) count++;
  if (filters.priceRange.min !== null || filters.priceRange.max !== null) count++;
  if (filters.minDiscount !== null) count++;
  return count;
};
