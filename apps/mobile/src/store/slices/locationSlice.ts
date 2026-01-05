/**
 * Location Redux Slice
 *
 * Manages user location state for geolocation-based offers discovery.
 *
 * Key features:
 * - GPS location via react-native-geolocation-service
 * - Manual location fallback (city/area search)
 * - Permission status tracking
 * - 24-hour location expiry for privacy
 * - Preferred radius persistence
 *
 * Privacy requirements:
 * - Never request location on app launch
 * - Auto-clear location after 24h of inactivity
 * - Never log coordinates with user identifiers
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import Geolocation, { type GeoError, type GeoPosition } from 'react-native-geolocation-service';
import { check, request, PERMISSIONS, RESULTS, type Permission } from 'react-native-permissions';
import { Platform } from 'react-native';

import { Logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export type LocationSource = 'gps' | 'manual' | null;

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked';

export interface LocationState {
  /** Current coordinates (GPS or manual) */
  coordinates: LocationCoordinates | null;
  /** GPS accuracy in meters (null for manual location) */
  accuracy: number | null;
  /** Source of the location data */
  source: LocationSource;
  /** Unix timestamp when location was acquired */
  timestamp: number | null;
  /** Current permission status */
  permissionStatus: PermissionStatus;
  /** Display name for manual location (e.g., "Paris, France") */
  manualLocationName: string | null;
  /** User's preferred search radius in kilometers */
  preferredRadiusKm: number;
  /** Whether we've ever prompted the user for location */
  hasPromptedForLocation: boolean;
  /** Unix timestamp when user dismissed the location prompt */
  promptDismissedAt: number | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

export interface LocationResult {
  success: boolean;
  coordinates?: LocationCoordinates;
  accuracy?: number;
  error?: string;
  errorCode?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Location expiry time: 24 hours in milliseconds */
const LOCATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Minimum time before re-showing dismissed prompt: 7 days */
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Geolocation request timeout: 10 seconds */
const GEOLOCATION_TIMEOUT_MS = 10000;

/** Maximum age for cached position: 5 minutes */
const MAXIMUM_AGE_MS = 5 * 60 * 1000;

/** Default search radius in kilometers */
const DEFAULT_RADIUS_KM = 25;

// ============================================================================
// Initial State
// ============================================================================

const initialState: LocationState = {
  coordinates: null,
  accuracy: null,
  source: null,
  timestamp: null,
  permissionStatus: 'undetermined',
  manualLocationName: null,
  preferredRadiusKm: DEFAULT_RADIUS_KM,
  hasPromptedForLocation: false,
  promptDismissedAt: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get platform-specific location permission
 */
function getLocationPermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    default: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  });
}

/**
 * Convert react-native-permissions result to our PermissionStatus
 */
function mapPermissionResult(result: string): PermissionStatus {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
    case RESULTS.UNAVAILABLE:
      return 'blocked';
    default:
      return 'undetermined';
  }
}

/**
 * Get user-friendly error message from GeoError code
 */
function getErrorMessage(error: GeoError): string {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission denied';
    case 2: // POSITION_UNAVAILABLE
      return 'Unable to determine location. Please check your device settings.';
    case 3: // TIMEOUT
      return 'Location request timed out. Please try again.';
    default:
      return 'An error occurred while getting your location.';
  }
}

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Check current permission status without requesting
 */
export const checkPermissionAsync = createAsyncThunk<
  PermissionStatus,
  void,
  { rejectValue: string }
>('location/checkPermission', async (_, { rejectWithValue }) => {
  try {
    const permission = getLocationPermission();
    const result = await check(permission);
    const status = mapPermissionResult(result);
    Logger.debug('Location permission checked', { status });
    return status;
  } catch (error) {
    Logger.error('Failed to check location permission', {}, error as Error);
    return rejectWithValue('Failed to check location permission');
  }
});

/**
 * Request location permission and get current position
 *
 * This is the main entry point for getting user location.
 * It handles:
 * 1. Requesting permission (if not already granted)
 * 2. Getting current position via GPS
 * 3. Updating Redux state with result
 */
export const requestLocationAsync = createAsyncThunk<
  LocationResult,
  void,
  { rejectValue: LocationResult }
>('location/requestLocation', async (_, { rejectWithValue }) => {
  try {
    // 1. Request permission
    const permission = getLocationPermission();
    const permResult = await request(permission);
    const permStatus = mapPermissionResult(permResult);

    Logger.info('Location permission requested', { status: permStatus });

    if (permStatus !== 'granted') {
      return rejectWithValue({
        success: false,
        error: 'Location permission not granted',
        errorCode: 1,
      });
    }

    // 2. Get current position
    return new Promise<LocationResult>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position: GeoPosition) => {
          const result: LocationResult = {
            success: true,
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
          };
          Logger.info('Location acquired successfully');
          resolve(result);
        },
        (error: GeoError) => {
          Logger.warn('Location acquisition failed', { code: error.code });
          reject(
            rejectWithValue({
              success: false,
              error: getErrorMessage(error),
              errorCode: error.code,
            }),
          );
        },
        {
          enableHighAccuracy: false, // Use approximate first for faster response
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: MAXIMUM_AGE_MS,
        },
      );
    });
  } catch (error) {
    Logger.error('Location request failed', {}, error as Error);
    return rejectWithValue({
      success: false,
      error: 'Failed to get location',
    });
  }
});

/**
 * Clear expired location data (>24h old)
 *
 * Should be called on app startup and periodically.
 */
export const clearExpiredLocationAsync = createAsyncThunk<
  boolean,
  void,
  { state: { location: LocationState } }
>('location/clearExpired', async (_, { getState, dispatch }) => {
  const { timestamp } = getState().location;

  if (timestamp) {
    const age = Date.now() - timestamp;
    if (age > LOCATION_EXPIRY_MS) {
      dispatch(clearLocation());
      Logger.info('Location cleared due to expiry (>24h)');
      return true;
    }
  }

  return false;
});

// ============================================================================
// Slice
// ============================================================================

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    /**
     * Set GPS coordinates
     */
    setCoordinates: (
      state,
      action: PayloadAction<{
        coordinates: LocationCoordinates;
        accuracy: number | null;
      }>,
    ) => {
      state.coordinates = action.payload.coordinates;
      state.accuracy = action.payload.accuracy;
      state.source = 'gps';
      state.timestamp = Date.now();
      state.manualLocationName = null;
      state.error = null;
    },

    /**
     * Set permission status
     */
    setPermissionStatus: (state, action: PayloadAction<PermissionStatus>) => {
      state.permissionStatus = action.payload;
    },

    /**
     * Set manual location (from city search)
     */
    setManualLocation: (
      state,
      action: PayloadAction<{
        coordinates: LocationCoordinates;
        name: string;
      }>,
    ) => {
      state.coordinates = action.payload.coordinates;
      state.manualLocationName = action.payload.name;
      state.source = 'manual';
      state.timestamp = Date.now();
      state.accuracy = null; // No accuracy for manual location
      state.error = null;
    },

    /**
     * Set preferred search radius
     */
    setPreferredRadius: (state, action: PayloadAction<number>) => {
      // Clamp to valid range: 1-100 km
      state.preferredRadiusKm = Math.max(1, Math.min(100, action.payload));
    },

    /**
     * Mark that user has dismissed the location prompt
     */
    dismissPrompt: state => {
      state.hasPromptedForLocation = true;
      state.promptDismissedAt = Date.now();
    },

    /**
     * Reset prompt dismissal (show prompt again)
     */
    resetPromptDismissal: state => {
      state.promptDismissedAt = null;
    },

    /**
     * Clear all location data
     */
    clearLocation: state => {
      state.coordinates = null;
      state.accuracy = null;
      state.source = null;
      state.timestamp = null;
      state.manualLocationName = null;
      state.error = null;
      // Note: Do NOT clear permissionStatus, hasPromptedForLocation, or preferredRadiusKm
    },

    /**
     * Clear error state
     */
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    // checkPermissionAsync
    builder.addCase(checkPermissionAsync.fulfilled, (state, action) => {
      state.permissionStatus = action.payload;
    });

    // requestLocationAsync
    builder.addCase(requestLocationAsync.pending, state => {
      state.isLoading = true;
      state.error = null;
      state.hasPromptedForLocation = true;
    });
    builder.addCase(requestLocationAsync.fulfilled, (state, action) => {
      state.isLoading = false;
      state.permissionStatus = 'granted';
      if (action.payload.coordinates) {
        state.coordinates = action.payload.coordinates;
        state.accuracy = action.payload.accuracy ?? null;
        state.source = 'gps';
        state.timestamp = Date.now();
        state.manualLocationName = null;
      }
    });
    builder.addCase(requestLocationAsync.rejected, (state, action) => {
      state.isLoading = false;
      if (action.payload) {
        state.error = action.payload.error ?? 'Location request failed';
        // Update permission status if denied
        if (action.payload.errorCode === 1) {
          state.permissionStatus = 'denied';
        }
      }
    });
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  setCoordinates,
  setPermissionStatus,
  setManualLocation,
  setPreferredRadius,
  dismissPrompt,
  resetPromptDismissal,
  clearLocation,
  clearError,
} = locationSlice.actions;

export default locationSlice.reducer;

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select whether user has a valid (non-expired) location
 */
export const selectHasValidLocation = (state: { location: LocationState }): boolean => {
  const { coordinates, timestamp } = state.location;
  if (!coordinates || !timestamp) return false;

  const age = Date.now() - timestamp;
  return age <= LOCATION_EXPIRY_MS;
};

/**
 * Select whether to show the location prompt banner
 *
 * Show prompt if:
 * - User has never been prompted, OR
 * - User dismissed prompt > 7 days ago
 * AND
 * - Location permission is not already granted
 */
export const selectShouldShowPrompt = (state: { location: LocationState }): boolean => {
  const { hasPromptedForLocation, promptDismissedAt, permissionStatus, coordinates } = state.location;

  // Already have location or permission granted
  if (coordinates || permissionStatus === 'granted') {
    return false;
  }

  // Never prompted
  if (!hasPromptedForLocation) {
    return true;
  }

  // Prompt was dismissed - check cooldown
  if (promptDismissedAt) {
    const timeSinceDismissal = Date.now() - promptDismissedAt;
    return timeSinceDismissal > PROMPT_COOLDOWN_MS;
  }

  return false;
};

/**
 * Select location source display name
 */
export const selectLocationSourceDisplay = (
  state: { location: LocationState },
): { mode: 'gps' | 'manual' | 'off'; label: string } => {
  const { source, manualLocationName } = state.location;

  if (source === 'gps') {
    return { mode: 'gps', label: 'Using GPS' };
  }
  if (source === 'manual' && manualLocationName) {
    return { mode: 'manual', label: manualLocationName };
  }
  return { mode: 'off', label: 'Location off' };
};
