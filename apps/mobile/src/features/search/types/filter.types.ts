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
  [key: string]: unknown;
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
export const hasActiveFilters = (filters: FilterState): boolean =>
  filters.offerType !== null ||
  filters.establishmentTypes.length > 0 ||
  filters.cuisineTypes.length > 0 ||
  filters.categories.length > 0 ||
  filters.priceRange.min !== null ||
  filters.priceRange.max !== null ||
  filters.minDiscount !== null;

/**
 * Count active filters — **every** filter, including establishment types.
 *
 * This is the analytics/total count. For the badge on the filter button use
 * `countSheetFilters` instead: see below for why the two differ.
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

/*
 * ──────────────────────────────────────────────────────────────────────────
 * Sheet-scoped variants
 *
 * Establishment type is no longer a bottom-sheet filter. It is set from the
 * category rail on the home screen, and the selected tile is its indicator.
 *
 * So the badge on the filter button must not count it. If it did, tapping a
 * category tile would light up a badge on a sheet that contains no such
 * control — the user opens it looking for the "1" and finds nothing to clear.
 * Two indicators for one selection, one of which leads nowhere.
 *
 * `countActiveFilters` above still counts everything, because analytics and
 * "does this user have any filter at all" genuinely want the total.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Whether any filter the bottom sheet actually owns is set. */
export const hasSheetFilters = (filters: FilterState): boolean =>
  filters.offerType !== null ||
  filters.cuisineTypes.length > 0 ||
  filters.categories.length > 0 ||
  filters.priceRange.min !== null ||
  filters.priceRange.max !== null ||
  filters.minDiscount !== null;

/** Count of bottom-sheet filters only — drives the filter button's badge. */
export const countSheetFilters = (filters: FilterState): number => {
  let count = 0;
  if (filters.offerType !== null) count++;
  if (filters.cuisineTypes.length > 0) count++;
  if (filters.categories.length > 0) count++;
  if (filters.priceRange.min !== null || filters.priceRange.max !== null) count++;
  if (filters.minDiscount !== null) count++;
  return count;
};
