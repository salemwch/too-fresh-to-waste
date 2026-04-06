/**
 * useHomeFilters Hook
 * Centralized filter state management for HomeScreen
 *
 * Responsibilities:
 * - Filter state management
 * - Search query management with debouncing
 * - AsyncStorage persistence
 * - Analytics tracking
 * - Filter-to-API parameter conversion
 *
 * Best Practice: Extract complex business logic into custom hooks
 * for better reusability, testability, and separation of concerns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  INITIAL_FILTER_STATE as INITIAL_STATE,
  hasActiveFilters as hasFilters,
  countActiveFilters as countFilters,
} from '@/features/search/types/filter.types';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';

import {
  HOME_STORAGE_KEYS,
  HOME_UI_CONFIG,
  HOME_ANALYTICS_EVENTS,
} from '../constants/homeConstants';

import type { OfferSearchParams, EstablishmentType } from '@/features/offers/types/offer.types';
import type { FilterState } from '@/features/search/types/filter.types';

// Import filter utilities

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for useHomeFilters hook
 */
interface UseHomeFiltersResult {
  /** Current filter state */
  filters: FilterState;
  /** Raw search query (not debounced) */
  searchQuery: string;
  /** Debounced search query for API calls */
  debouncedSearchQuery: string;
  /** Converted filter parameters ready for API consumption */
  filterParams: Partial<
    Pick<
      OfferSearchParams,
      'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories' | 'search'
    >
  >;
  /** Whether any filters are currently active */
  hasActiveFilters: boolean;
  /** Count of active filters */
  activeFilterCount: number;
  /** Set filter state directly */
  setFilters: (filters: FilterState) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Apply filters with analytics tracking */
  handleApplyFilters: (filters: FilterState) => void;
  /** Clear all filters with analytics tracking */
  handleClearAllFilters: () => void;
  /** Remove offer type filter */
  handleRemoveOfferType: () => void;
  /** Remove specific establishment type */
  handleRemoveEstablishmentType: (type: EstablishmentType) => void;
  /** Remove specific cuisine type */
  handleRemoveCuisineType: (cuisine: string) => void;
  /** Remove specific category */
  handleRemoveCategory: (category: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing home screen filters
 *
 * Features:
 * - Persists filters to AsyncStorage
 * - Debounces search queries
 * - Tracks analytics events
 * - Validates and sanitizes filter values
 * - Converts filters to API parameters
 *
 * @returns UseHomeFiltersResult
 *
 * @example
 * ```typescript
 * const {
 *   filters,
 *   filterParams,
 *   handleApplyFilters,
 * } = useHomeFilters();
 *
 * // Use filterParams in API calls
 * const { data } = useOffers(filterParams);
 * ```
 */
export function useHomeFilters(): UseHomeFiltersResult {
  // ============================================================================
  // State
  // ============================================================================

  const [filters, setFilters] = useState<FilterState>(INITIAL_STATE);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Load persisted filters on mount
   */
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(HOME_STORAGE_KEYS.FILTERS);
        if (stored !== null) {
          const parsedFilters = JSON.parse(stored) as FilterState;
          setFilters(parsedFilters);
          Logger.debug('[useHomeFilters] Filters restored from storage', parsedFilters);
        }
      } catch (error) {
        Logger.error('[useHomeFilters] Failed to load persisted filters', { error });
      }
    };

    void loadFilters();
  }, []);

  /**
   * Persist filters when they change
   */
  useEffect(() => {
    const persistFilters = async () => {
      try {
        await AsyncStorage.setItem(HOME_STORAGE_KEYS.FILTERS, JSON.stringify(filters));
        Logger.debug('[useHomeFilters] Filters persisted to storage', filters);
      } catch (error) {
        Logger.error('[useHomeFilters] Failed to persist filters', { error });
      }
    };

    void persistFilters();
  }, [filters]);

  /**
   * Debounce search query
   * Wait 300ms after user stops typing before updating debounced value
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);

      // Track search analytics (only if query is not empty)
      if (searchQuery.trim().length > 0) {
        analytics.track(HOME_ANALYTICS_EVENTS.SEARCH_PERFORMED, {
          query: searchQuery,
          length: searchQuery.length,
        });
      }
    }, HOME_UI_CONFIG.SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  /**
   * Convert filter state to API parameters
   * Includes validation and sanitization
   */
  const filterParams = useMemo(() => {
    try {
      const params: Partial<
        Pick<
          OfferSearchParams,
          'type' | 'establishmentTypes' | 'cuisineTypes' | 'categories' | 'search'
        >
      > = {};

      // Search query (debounced)
      if (debouncedSearchQuery.trim().length > 0) {
        params.search = debouncedSearchQuery.trim();
      }

      // Offer type
      if (filters.offerType != null) {
        params.type = filters.offerType;
      }

      // Establishment types (validate and sanitize)
      if (filters.establishmentTypes.length > 0) {
        const validTypes = filters.establishmentTypes.filter(
          type => Boolean(type), // Basic validation
        );
        if (validTypes.length > 0) {
          params.establishmentTypes = [...validTypes]; // Defensive copy
        }
      }

      // Cuisine types (validate and sanitize)
      if (filters.cuisineTypes.length > 0) {
        const validCuisines = filters.cuisineTypes.filter(
          cuisine => typeof cuisine === 'string' && cuisine.trim().length > 0,
        );
        if (validCuisines.length > 0) {
          params.cuisineTypes = validCuisines.map(c => c.trim());
        }
      }

      // Categories (validate and sanitize)
      if (filters.categories.length > 0) {
        const validCategories = filters.categories.filter(
          category => typeof category === 'string' && category.trim().length > 0,
        );
        if (validCategories.length > 0) {
          params.categories = validCategories.map(c => c.trim());
        }
      }

      Logger.debug('[useHomeFilters] Filter params computed', {
        params,
        originalFilters: filters,
        debouncedSearchQuery,
      });

      return params;
    } catch (error) {
      // Graceful degradation on error
      Logger.error('[useHomeFilters] Failed to convert filters to params', {
        error,
        filters,
        debouncedSearchQuery,
      });
      return {};
    }
  }, [filters, debouncedSearchQuery]);

  /**
   * Check if any filters are active
   */
  const hasActiveFiltersValue = useMemo(() => hasFilters(filters), [filters]);

  /**
   * Count active filters
   */
  const activeFilterCount = useMemo(() => countFilters(filters), [filters]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Apply filters with analytics tracking
   */
  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    // Track analytics
    analytics.trackFiltersApplied({
      ...(newFilters.offerType != null && { offerType: String(newFilters.offerType) }),
      establishmentCount: newFilters.establishmentTypes.length,
      establishmentTypes: newFilters.establishmentTypes.map(String),
      cuisineCount: newFilters.cuisineTypes.length,
      cuisineTypes: newFilters.cuisineTypes,
      categoryCount: newFilters.categories.length,
      categories: newFilters.categories,
      totalFilters: countFilters(newFilters),
      source: 'home_screen',
    });

    setFilters(newFilters);
  }, []);

  /**
   * Clear all filters with analytics tracking
   */
  const handleClearAllFilters = useCallback(() => {
    // Track analytics
    analytics.trackFiltersCleared({
      previousFilterCount: countFilters(filters),
      source: 'home_screen',
    });

    setFilters(INITIAL_STATE);
  }, [filters]);

  /**
   * Remove offer type filter
   */
  const handleRemoveOfferType = useCallback(() => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'offerType',
      value: filters.offerType ?? 'unknown',
      source: 'home_screen',
    });

    setFilters(prev => ({ ...prev, offerType: null }));
  }, [filters.offerType]);

  /**
   * Remove specific establishment type
   */
  const handleRemoveEstablishmentType = useCallback((type: EstablishmentType) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'establishmentType',
      value: type,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      establishmentTypes: prev.establishmentTypes.filter(t => t !== type),
    }));
  }, []);

  /**
   * Remove specific cuisine type
   */
  const handleRemoveCuisineType = useCallback((cuisine: string) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'cuisineType',
      value: cuisine,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.filter(c => c !== cuisine),
    }));
  }, []);

  /**
   * Remove specific category
   */
  const handleRemoveCategory = useCallback((category: string) => {
    // Track analytics
    analytics.trackFilterRemoved({
      filterType: 'category',
      value: category,
      source: 'home_screen',
    });

    setFilters(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category),
    }));
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    filters,
    searchQuery,
    debouncedSearchQuery,
    filterParams,
    hasActiveFilters: hasActiveFiltersValue,
    activeFilterCount,
    setFilters,
    setSearchQuery,
    handleApplyFilters,
    handleClearAllFilters,
    handleRemoveOfferType,
    handleRemoveEstablishmentType,
    handleRemoveCuisineType,
    handleRemoveCategory,
  };
}
