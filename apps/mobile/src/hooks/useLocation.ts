/**
 * useLocation Hook
 *
 * Provides a unified interface for location management in the app.
 * Wraps Redux location slice with convenient methods and computed values.
 *
 * Features:
 * - GPS location via react-native-geolocation-service
 * - Manual location fallback (city search)
 * - Permission status tracking
 * - Location persists indefinitely until manually changed
 * - Preferred radius management
 *
 * Usage:
 * ```tsx
 * const {
 *   coordinates,
 *   hasLocation,
 *   requestLocation,
 *   shouldShowPrompt
 * } = useLocation();
 * ```
 */

import { useCallback } from 'react';

import {
  type LocationCoordinates,
  type LocationResult,
  type LocationSource,
  type PermissionStatus,
  checkPermissionAsync,
  requestLocationAsync,
  setManualLocation,
  setPreferredRadius,
  dismissPrompt,
  resetPromptDismissal,
  clearLocation,
  clearError,
  selectHasValidLocation,
  selectShouldShowPrompt,
  selectLocationSourceDisplay,
} from '@/store/slices/locationSlice';

import { useAppDispatch, useAppSelector } from './redux';

// ============================================================================
// Types
// ============================================================================

export interface UseLocationReturn {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Current coordinates (GPS or manual) */
  coordinates: LocationCoordinates | null;

  /** GPS accuracy in meters (null for manual) */
  accuracy: number | null;

  /** Source of location: 'gps', 'manual', or null */
  source: LocationSource;

  /** Current permission status */
  permissionStatus: PermissionStatus;

  /** Whether location request is in progress */
  isLoading: boolean;

  /** Error message from last failed operation */
  error: string | null;

  /** User's preferred search radius in km */
  preferredRadiusKm: number;

  /** Display name for manual location */
  manualLocationName: string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether user has any location set */
  hasLocation: boolean;

  /** Whether location is valid (exists and not expired) */
  hasValidLocation: boolean;

  /** Whether to show location prompt banner */
  shouldShowPrompt: boolean;

  /** Location mode for display: { mode: 'gps'|'manual'|'off', label: string } */
  locationSourceDisplay: { mode: 'gps' | 'manual' | 'off'; label: string };

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Request location permission and get current GPS position
   * @returns Promise with result containing coordinates or error
   */
  requestLocation: () => Promise<LocationResult>;

  /**
   * Check current permission status without requesting
   * @returns Promise with current permission status
   */
  checkPermission: () => Promise<PermissionStatus>;

  /**
   * Set location manually (from city/area search)
   * @param coordinates - Lat/lng coordinates
   * @param name - Display name (e.g., "Paris, France")
   */
  setManualLocationValue: (coordinates: LocationCoordinates, name: string) => void;

  /**
   * Set preferred search radius
   * @param radiusKm - Radius in kilometers (1-100)
   */
  setRadius: (radiusKm: number) => void;

  /**
   * Clear all location data
   */
  clearLocationData: () => void;

  /**
   * Dismiss the location prompt banner
   */
  dismissLocationPrompt: () => void;

  /**
   * Reset prompt dismissal (show prompt again)
   */
  resetLocationPrompt: () => void;

  /**
   * Clear error state
   */
  clearLocationError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useLocation(): UseLocationReturn {
  const dispatch = useAppDispatch();

  // ─────────────────────────────────────────────────────────────────────────
  // Select state from Redux
  // ─────────────────────────────────────────────────────────────────────────

  const locationState = useAppSelector(state => state.location);
  const hasValidLocation = useAppSelector(selectHasValidLocation);
  const shouldShowPrompt = useAppSelector(selectShouldShowPrompt);
  const locationSourceDisplay = useAppSelector(selectLocationSourceDisplay);

  const {
    coordinates,
    accuracy,
    source,
    permissionStatus,
    isLoading,
    error,
    preferredRadiusKm,
    manualLocationName,
  } = locationState;

  // ─────────────────────────────────────────────────────────────────────────
  // Action handlers
  // ─────────────────────────────────────────────────────────────────────────

  const requestLocation = useCallback(async (): Promise<LocationResult> => {
    try {
      const result = await dispatch(requestLocationAsync()).unwrap();
      return result;
    } catch (error) {
      // Error is already in Redux state via rejected action
      return error as LocationResult;
    }
  }, [dispatch]);

  const checkPermission = useCallback(async (): Promise<PermissionStatus> => {
    try {
      const status = await dispatch(checkPermissionAsync()).unwrap();
      return status;
    } catch {
      return 'undetermined';
    }
  }, [dispatch]);

  const setManualLocationValue = useCallback(
    (coords: LocationCoordinates, name: string) => {
      dispatch(setManualLocation({ coordinates: coords, name }));
    },
    [dispatch],
  );

  const setRadius = useCallback(
    (radiusKm: number) => {
      dispatch(setPreferredRadius(radiusKm));
    },
    [dispatch],
  );

  const clearLocationData = useCallback(() => {
    dispatch(clearLocation());
  }, [dispatch]);

  const dismissLocationPrompt = useCallback(() => {
    dispatch(dismissPrompt());
  }, [dispatch]);

  const resetLocationPrompt = useCallback(() => {
    dispatch(resetPromptDismissal());
  }, [dispatch]);

  const clearLocationError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // Return hook interface
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // State
    coordinates,
    accuracy,
    source,
    permissionStatus,
    isLoading,
    error,
    preferredRadiusKm,
    manualLocationName,

    // Computed
    hasLocation: coordinates !== null,
    hasValidLocation,
    shouldShowPrompt,
    locationSourceDisplay,

    // Actions
    requestLocation,
    checkPermission,
    setManualLocationValue,
    setRadius,
    clearLocationData,
    dismissLocationPrompt,
    resetLocationPrompt,
    clearLocationError,
  };
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type { LocationCoordinates, LocationResult, LocationSource, PermissionStatus };
