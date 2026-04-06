/**
 * useLocationSetup Hook
 * Centralized location setup and modal management for first-time users
 *
 * Responsibilities:
 * - Check if user has completed location setup
 * - Restore location from backend for returning users
 * - Manage location selection modals
 * - Sync location to backend for cross-device persistence
 *
 * Best Practice: Extract complex cross-cutting concerns into reusable hooks
 * Reduces parent component complexity and improves testability
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

import { userService } from '@/features/profile/services';
import { useAppDispatch } from '@/hooks/redux';
import { reverseGeocodeAsync } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';

import { HOME_STORAGE_KEYS } from '../constants/homeConstants';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for useLocationSetup hook
 */
interface UseLocationSetupResult {
  /** Whether to show location selection modal (first-time setup) */
  showLocationSelectionModal: boolean;
  /** Whether to show manual location modal (GPS fallback) */
  showManualLocationModal: boolean;
  /** Location error message */
  locationError: string | null;
  /** Close location selection modal */
  closeLocationSelectionModal: () => void;
  /** Open manual location modal */
  openManualLocationModal: () => void;
  /** Close manual location modal */
  closeManualLocationModal: () => void;
  /** Handle location selection from LocationSelectionModal */
  handleLocationSelection: (
    coordinates: { latitude: number; longitude: number },
    name: string,
  ) => Promise<void>;
  /** Handle manual location selection */
  handleManualLocationSelect: (location: {
    coordinates: { latitude: number; longitude: number };
    name: string;
  }) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing location setup flow
 *
 * Features:
 * - Auto-restore location from backend for returning users
 * - First-time setup modal for new users
 * - Cross-device location sync
 * - GPS fallback to manual entry
 * - Error handling with user feedback
 *
 * @param hasLocation - Whether user has location set locally
 * @param isAuthenticated - Whether user is authenticated
 * @param requestLocation - Function to request GPS location
 * @param setManualLocationValue - Function to set manual location
 * @returns UseLocationSetupResult
 *
 * @example
 * ```typescript
 * const {
 *   showLocationSelectionModal,
 *   handleLocationSelection,
 * } = useLocationSetup(hasLocation, isAuthenticated, requestLocation, setManualLocationValue);
 * ```
 */
export function useLocationSetup(
  hasLocation: boolean,
  isAuthenticated: boolean,
  requestLocation: () => Promise<{
    success: boolean;
    coordinates?: { latitude: number; longitude: number };
    error?: string;
  }>,
  setManualLocationValue: (
    coordinates: { latitude: number; longitude: number },
    name: string,
  ) => void,
): UseLocationSetupResult {
  // ============================================================================
  // State
  // ============================================================================

  const dispatch = useAppDispatch();
  const [showLocationSelectionModal, setShowLocationSelectionModal] = useState(false);
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ============================================================================
  // Effects - Location Setup Check
  // ============================================================================

  /**
   * Check if location setup modal should be shown (first time user)
   * Also fetch location from backend if user is authenticated but has no local location
   *
   * CRITICAL FIX: Only runs ONCE on mount, never re-runs when hasLocation changes
   */
  useEffect(() => {
    const checkLocationSetup = async () => {
      try {
        const hasCompleted = await AsyncStorage.getItem(HOME_STORAGE_KEYS.LOCATION_SETUP_COMPLETED);

        // If authenticated, no local location, but has completed setup before (returning user on new device)
        // Try fetching from backend. Skip for brand new users (hasCompleted === null)
        // ✅ CRITICAL FIX: Check current location source to avoid overwriting GPS
        const currentSource = await AsyncStorage.getItem('@food_waste_app:location_source');

        // Don't restore from backend if user just set GPS location
        if (currentSource === 'gps') {
          Logger.debug(
            '[useLocationSetup] Skipping backend restoration - GPS location already set',
          );
          return;
        }

        if (isAuthenticated && !hasLocation && hasCompleted !== null) {
          try {
            Logger.debug('[useLocationSetup] Attempting to restore location from backend...');
            const profile = await userService.getCurrentProfile();

            // Check if user has location preferences set
            if (profile?.locationPreferences?.defaultLocation) {
              const { latitude, longitude } = profile.locationPreferences.defaultLocation;
              Logger.debug('[useLocationSetup] Location found in backend, restoring...');

              // Set location from backend with temporary name
              // ✅ IMPROVED: Use reverse geocoding to get actual location name
              setManualLocationValue({ latitude, longitude }, 'Your saved location');

              // ✅ Trigger reverse geocoding to get actual location name (fire-and-forget)
              void dispatch(reverseGeocodeAsync({ latitude, longitude }))
                .unwrap()
                .then(() => {
                  Logger.debug('[useLocationSetup] ✅ Reverse geocoded restored location');
                })
                .catch((error: unknown) => {
                  // Non-blocking: If reverse geocoding fails, keep "Your saved location"
                  Logger.warn(
                    '[useLocationSetup] ⚠️ Reverse geocoding failed for restored location',
                    { error: String(error) },
                  );
                });

              await AsyncStorage.setItem(HOME_STORAGE_KEYS.LOCATION_SETUP_COMPLETED, 'true');
              Logger.debug('[useLocationSetup] Location restored from backend successfully');
              return; // Don't show modal if we got location from backend
            }
            Logger.debug('[useLocationSetup] No location found in backend for this user');
          } catch (error) {
            // Non-blocking: if backend fetch fails, continue with modal flow
            Logger.error(
              '[useLocationSetup] Failed to fetch location from backend:',
              {},
              error as Error,
            );
          }
        }

        // Show modal if user hasn't completed setup AND doesn't have location set
        if (hasCompleted === null && !hasLocation) {
          Logger.debug('[useLocationSetup] First-time user, showing location modal');
          setShowLocationSelectionModal(true);
        } else if (hasCompleted !== null && !hasLocation) {
          // Returning user but no location (edge case)
          Logger.debug('[useLocationSetup] Returning user with no location, showing modal');
          setShowLocationSelectionModal(true);
        }
      } catch (error) {
        Logger.error('[useLocationSetup] Failed to check location setup:', {}, error as Error);
      }
    };

    void checkLocationSetup();
    // ✅ CRITICAL FIX: Remove hasLocation from deps to prevent re-running after GPS is set
    // This effect should ONLY run once on mount to check for backend restoration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Handle location selection from LocationSelectionModal
   *
   * Production flow for GPS:
   * 1. Get GPS coordinates
   * 2. Trigger reverse geocoding and WAIT for it
   * 3. Close modal AFTER location name is ready
   * 4. Sync to backend (fire-and-forget)
   *
   * Best Practice: Keep modal visible until location name is resolved
   */
  const handleLocationSelection = useCallback(
    async (coordinates: { latitude: number; longitude: number }, name: string) => {
      setLocationError(null);

      // Check if GPS was requested (coordinates are 0,0 as signal)
      if (coordinates.latitude === 0 && coordinates.longitude === 0 && name === 'gps') {
        try {
          // Step 1: Get GPS coordinates
          const result = await requestLocation();

          if (!result.success || !result.coordinates) {
            // GPS failed, show error and keep modal open
            setLocationError(
              result.error ?? 'Failed to get your location. Please try another option.',
            );
            return;
          }

          // Step 2: Trigger reverse geocoding and WAIT for it
          Logger.debug('[useLocationSetup] GPS acquired, reverse geocoding...');

          try {
            await dispatch(reverseGeocodeAsync(result.coordinates)).unwrap();
            Logger.info(
              '[useLocationSetup] ✅ Reverse geocoding completed - location name resolved',
            );
          } catch (geocodeError) {
            // Non-blocking: If reverse geocoding fails, still use GPS coordinates
            // Header will show "Current Location" fallback
            Logger.warn('[useLocationSetup] ⚠️ Reverse geocoding failed, using fallback', {
              error: String(geocodeError),
            });
          }

          // Step 3: Close modal AFTER location name is ready
          setShowLocationSelectionModal(false);
          await AsyncStorage.setItem(HOME_STORAGE_KEYS.LOCATION_SETUP_COMPLETED, 'true');

          // Step 4: Sync location to backend (fire-and-forget)
          void (async () => {
            try {
              if (isAuthenticated && result.coordinates !== undefined) {
                await userService.updateLocation({
                  latitude: result.coordinates.latitude,
                  longitude: result.coordinates.longitude,
                  source: 'gps',
                });
                Logger.debug('[useLocationSetup] ✅ Synced GPS location to backend');
              }
            } catch (error) {
              // Non-blocking: log error but don't prevent local storage
              Logger.error(
                '[useLocationSetup] Failed to sync GPS location to backend:',
                {},
                error as Error,
              );
            }
          })();
        } catch (error) {
          Logger.error('[useLocationSetup] Failed to get GPS location:', {}, error as Error);
          setLocationError('Failed to get your location. Please try another option.');
        }
      } else {
        // Manual location or default location selected
        setManualLocationValue(coordinates, name);
        setShowLocationSelectionModal(false);
        await AsyncStorage.setItem(HOME_STORAGE_KEYS.LOCATION_SETUP_COMPLETED, 'true');

        // Sync location to backend for cross-device persistence
        try {
          if (isAuthenticated) {
            await userService.updateLocation({
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              locationName: name,
              source: 'manual',
            });
          }
        } catch (error) {
          // Non-blocking: log error but don't prevent local storage
          Logger.error(
            '[useLocationSetup] Failed to sync manual location to backend:',
            {},
            error as Error,
          );
        }
      }
    },
    [requestLocation, setManualLocationValue, isAuthenticated, dispatch],
  );

  /**
   * Handle manual location selection
   */
  const handleManualLocationSelect = useCallback(
    (location: { coordinates: { latitude: number; longitude: number }; name: string }) => {
      setManualLocationValue(location.coordinates, location.name);
      setShowManualLocationModal(false);
    },
    [setManualLocationValue],
  );

  /**
   * Close location selection modal
   */
  const closeLocationSelectionModal = useCallback(() => {
    setShowLocationSelectionModal(false);
    setLocationError(null);
  }, []);

  /**
   * Open manual location modal
   */
  const openManualLocationModal = useCallback(() => {
    setShowManualLocationModal(true);
  }, []);

  /**
   * Close manual location modal
   */
  const closeManualLocationModal = useCallback(() => {
    setShowManualLocationModal(false);
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    showLocationSelectionModal,
    showManualLocationModal,
    locationError,
    closeLocationSelectionModal,
    openManualLocationModal,
    closeManualLocationModal,
    handleLocationSelection,
    handleManualLocationSelect,
  };
}
