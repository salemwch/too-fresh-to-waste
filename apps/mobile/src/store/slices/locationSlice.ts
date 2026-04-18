/**
 * Location Redux Slice
 *
 * Manages user location state for geolocation-based offers discovery.
 *
 * Key features:
 * - GPS location via react-native-geolocation-service
 * - Manual location fallback (city/area search)
 * - Permission status tracking
 * - Location persists indefinitely until manually changed
 * - Preferred radius persistence
 *
 * Privacy requirements:
 * - Never request location on app launch
 * - Never log coordinates with user identifiers
 */

import {
  createSlice,
  createAsyncThunk,
  createSelector,
  type PayloadAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import Geolocation, {
  PositionError,
  type GeoError,
  type GeoPosition,
} from 'react-native-geolocation-service';
import { check, request, PERMISSIONS, RESULTS, type Permission } from 'react-native-permissions';

import { Logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export type LocationSource = 'gps' | 'manual' | null;

interface AuthSuccessMatcherAction {
  type: string;
  payload?: {
    user?: {
      userId?: string;
    };
  };
  [key: string]: unknown;
}

const AUTH_SUCCESS_ACTION_TYPES = new Set([
  'auth/login/fulfilled',
  'auth/verifyEmail/fulfilled',
  'auth/loadStoredAuth/fulfilled',
]);

const AUTH_LOGOUT_ACTION_TYPES = new Set(['auth/logout/fulfilled', 'auth/forceLocalLogout']);

const isAuthSuccessAction = (action: UnknownAction): action is AuthSuccessMatcherAction =>
  AUTH_SUCCESS_ACTION_TYPES.has(action.type);

const isAuthLogoutAction = (action: UnknownAction): boolean =>
  AUTH_LOGOUT_ACTION_TYPES.has(action.type);

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
  /** GPS location name from reverse geocoding (e.g., "Tel Aviv, Israel") */
  gpsLocationName: string | null;
  /** Timestamp when GPS location name was resolved */
  gpsLocationTimestamp: number | null;
  /** Coordinates that produced the GPS location name (for cache comparison) */
  gpsLocationCoordinates: LocationCoordinates | null;
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
  /** 🔒 User ID who owns this location data (for multi-account support) */
  userId: string | null;
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

/** Minimum time before re-showing dismissed prompt: 7 days */
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Geolocation request timeout: 30 seconds (longer for emulators/slow GPS) */
const GEOLOCATION_TIMEOUT_MS = 30000;

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
  gpsLocationName: null,
  gpsLocationTimestamp: null,
  gpsLocationCoordinates: null,
  preferredRadiusKm: DEFAULT_RADIUS_KM,
  hasPromptedForLocation: false,
  promptDismissedAt: null,
  isLoading: false,
  error: null,
  userId: null,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Round coordinates to reduce duplicate reverse geocoding calls.
 *
 * **Precision**: 4 decimals ≈ 11m (building-level accuracy)
 * - Suitable for neighborhood/district-level reverse geocoding
 * - Prevents cache misses when user moves short distances (< 10m)
 * - Safe for city boundaries and offer distance filtering
 *
 * **Why 4 decimals?**
 * - 3 decimals (111m) can collapse different neighborhoods in dense cities
 * - 4 decimals (11m) provides neighborhood-level accuracy without excessive API calls
 * - Balances cache hit rate with location precision
 *
 * @param coords - Coordinates to round
 * @returns Rounded coordinates (4 decimal places)
 */
function roundCoordinates(coords: LocationCoordinates): LocationCoordinates {
  return {
    latitude: Math.round(coords.latitude * 10000) / 10000, // 4 decimals ≈ 11m
    longitude: Math.round(coords.longitude * 10000) / 10000,
  };
}

/**
 * Check if coordinates are significantly different (after rounding).
 * Used for cache invalidation.
 *
 * @param a - First coordinates
 * @param b - Second coordinates
 * @returns True if coordinates changed significantly
 */
function coordinatesChanged(a: LocationCoordinates | null, b: LocationCoordinates | null): boolean {
  if (!a || !b) return true;
  const roundedA = roundCoordinates(a);
  const roundedB = roundCoordinates(b);
  return roundedA.latitude !== roundedB.latitude || roundedA.longitude !== roundedB.longitude;
}

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
    case PositionError.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your device settings.';
    case PositionError.POSITION_UNAVAILABLE:
      return 'Unable to determine location. Please check your device settings or try "Use default location".';
    case PositionError.TIMEOUT:
      return 'GPS signal not found. For faster setup, try "Use default location" or search for your city.';
    case PositionError.PLAY_SERVICE_NOT_AVAILABLE:
      return 'Google Play services are unavailable. Please update your device services or use a manual location.';
    case PositionError.SETTINGS_NOT_SATISFIED:
      return 'Your location settings do not satisfy this request. Enable high-accuracy location or use a manual location.';
    case PositionError.INTERNAL_ERROR:
      return 'An internal location error occurred. Please try again or use a manual location.';
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
          enableHighAccuracy: true, // Required for Android emulators and some devices
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
 * Reverse geocode coordinates to get location name.
 *
 * Production features:
 * - 15-second timeout to prevent indefinite waits
 * - Cache check: skip if we have fresh data for same location
 * - Anti-flicker: never set name to null, only update on success
 * - Coordinate rounding: reduces duplicate API calls
 * - **Proper cancellation**: Respects Redux Toolkit signal for cleanup
 *
 * Cache invalidation:
 * - Coordinates changed (after rounding)
 * - Cached data older than 24 hours
 *
 * @param coordinates - GPS coordinates to reverse geocode
 * @returns Address information with city and country
 */
export const reverseGeocodeAsync = createAsyncThunk<
  { city: string; country: string },
  LocationCoordinates,
  { state: { location: LocationState }; rejectValue: string }
>('location/reverseGeocode', async (coordinates, { getState, rejectWithValue, signal }) => {
  const state = getState().location;

  // ────────────────────────────────────────────────────────────────────────
  // Early Abort Check: Don't start if already cancelled
  // ────────────────────────────────────────────────────────────────────────
  if (signal.aborted) {
    Logger.debug('Reverse geocoding aborted before starting');
    return rejectWithValue('Cancelled');
  }

  // ────────────────────────────────────────────────────────────────────────
  // Cache Check: Skip if we have fresh data for same location
  // ────────────────────────────────────────────────────────────────────────
  // Cache TTL: 1 hour (not 24h) to handle mobile users:
  // - Traveling between cities
  // - Commuting/driving long distances
  // - Moving between neighborhoods
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  if (
    state.gpsLocationName &&
    state.gpsLocationTimestamp &&
    state.gpsLocationCoordinates &&
    Date.now() - state.gpsLocationTimestamp < CACHE_TTL_MS &&
    !coordinatesChanged(coordinates, state.gpsLocationCoordinates)
  ) {
    Logger.debug('Using cached GPS location name', {
      name: state.gpsLocationName,
      age: Date.now() - state.gpsLocationTimestamp,
    });
    // Return cached data as successful result
    return { city: state.gpsLocationName, country: '' };
  }

  try {
    // ────────────────────────────────────────────────────────────────────────
    // Dynamic import to avoid circular dependencies
    // Import directly from source file, not barrel export, to break cycle
    // ────────────────────────────────────────────────────────────────────────
    const { nearbyOffersService } = await import('@/features/offers/services/nearbyOffersService');

    // Check if aborted after import
    if (signal.aborted) {
      Logger.debug('Reverse geocoding aborted after import');
      return rejectWithValue('Cancelled');
    }

    // ────────────────────────────────────────────────────────────────────────
    // Timeout: Reject if response takes > 15 seconds
    // ────────────────────────────────────────────────────────────────────────
    const TIMEOUT_MS = 15000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Reverse geocoding timeout'));
      }, TIMEOUT_MS);

      // ✅ Clear timeout if cancelled via signal
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Cancelled'));
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // Round coordinates to improve cache hit rate
    // ────────────────────────────────────────────────────────────────────────
    const roundedCoords = roundCoordinates(coordinates);
    Logger.debug('Reverse geocoding with rounded coordinates', { roundedCoords });

    // ✅ Pass Redux signal to API call for proper cancellation
    const geocodePromise = nearbyOffersService.reverseGeocode(
      roundedCoords,
      'en',
      signal, // Redux Toolkit will abort this when thunk is cancelled
    );

    // Race between geocoding and timeout
    const addressInfo = await Promise.race([geocodePromise, timeoutPromise]);

    // Final abort check before returning
    if (signal.aborted) {
      Logger.debug('Reverse geocoding aborted after completion');
      return rejectWithValue('Cancelled');
    }

    // ✅ FIX: Backend returns { primaryAddress: { city, country } }
    // Extract city and country from primaryAddress
    const city = addressInfo.primaryAddress?.city ?? addressInfo.city ?? '';
    const country = addressInfo.primaryAddress?.country ?? addressInfo.country ?? '';

    Logger.info('Reverse geocoding successful', {
      city,
      country,
    });

    return {
      city,
      country,
    };
  } catch (error) {
    // Check if error is due to cancellation
    if (signal.aborted || (error instanceof Error && error.message === 'Cancelled')) {
      Logger.debug('Reverse geocoding cancelled');
      return rejectWithValue('Cancelled');
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to resolve location name';
    Logger.warn('Reverse geocoding failed', { error: errorMessage });
    return rejectWithValue(errorMessage);
  }
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
      // Clear GPS location data when manually selecting
      state.gpsLocationName = null;
      state.gpsLocationTimestamp = null;
      state.gpsLocationCoordinates = null;
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
      state.gpsLocationName = null;
      state.gpsLocationTimestamp = null;
      state.gpsLocationCoordinates = null;
      state.error = null;
      // Note: Do NOT clear permissionStatus, hasPromptedForLocation, or preferredRadiusKm
    },

    /**
     * Clear error state
     */
    clearError: state => {
      state.error = null;
    },

    /**
     * 🔒 SECURITY: Clear all location data (called on logout)
     *
     * Prevents location data leak when user is deleted:
     * - User A logs in → Saves location to MMKV
     * - User A deleted → Must clear MMKV location
     * - User B logs in → Should NOT see User A's location
     *
     * GDPR Compliance: Location data must be deleted with user account
     */
    clearAll: () => {
      Logger.info('[LOCATION] Clearing all location data (user logout/deletion)');
      return initialState;
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

    // ────────────────────────────────────────────────────────────────────────
    // reverseGeocodeAsync Handlers
    // ────────────────────────────────────────────────────────────────────────
    builder.addCase(reverseGeocodeAsync.fulfilled, (state, action) => {
      const { city } = action.payload;

      // ────────────────────────────────────────────────────────────────────────
      // 🛡️ RACE CONDITION GUARD: Verify coordinates still match
      // ────────────────────────────────────────────────────────────────────────
      // Timeline of race condition:
      // 1. User taps GPS → coords A → reverse geocode A starts
      // 2. User moves → taps GPS → coords B → reverse geocode B starts
      // 3. Geocode A finishes AFTER B → tries to update with wrong city
      //
      // Solution: Only update if result is for CURRENT coordinates
      const geocodedCoords = action.meta.arg; // Coordinates we just geocoded
      const currentCoords = state.coordinates; // Current coordinates in state

      if (!currentCoords || !coordinatesChanged(geocodedCoords, currentCoords)) {
        // ✅ Coordinates match (or very close after rounding) → safe to update

        // Build location name from address components
        const locationName = city || null;

        if (locationName) {
          // ✅ Anti-flicker: only update when we have a valid name
          state.gpsLocationName = locationName;
          state.gpsLocationTimestamp = Date.now();
          // Store which coordinates produced this name (for cache invalidation)
          state.gpsLocationCoordinates = currentCoords;
          Logger.debug('GPS location name resolved', { locationName });
        }
      } else {
        // ❌ Coordinates changed during geocoding → discard stale result
        Logger.warn('Discarding stale reverse geocoding result', {
          geocodedCoords,
          currentCoords,
          staleName: city,
        });
      }
    });

    builder.addCase(reverseGeocodeAsync.rejected, (_state, action) => {
      Logger.warn('Reverse geocoding rejected', { reason: action.payload });
      // ✅ Anti-flicker: DON'T set gpsLocationName to null
      // Keep old value to prevent header from flickering to "Current Location"
      // User will see last known location name or fallback text
    });

    // ────────────────────────────────────────────────────────────────────────
    // 🔒 User switch detection on ANY authentication entry point
    // ────────────────────────────────────────────────────────────────────────
    // Catches ALL ways a user can become authenticated:
    // - auth/login/fulfilled        → manual login
    // - auth/verifyEmail/fulfilled  → email verification auto-login
    // - auth/loadStoredAuth/fulfilled → app restart rehydration
    //
    // Scenario 1: Same user logs out & back in → KEEP location
    // Scenario 2: Account deleted + new signup  → CLEAR location + show prompt
    builder.addMatcher(isAuthSuccessAction, (state, action) => {
      const newUserId = action.payload?.user?.userId;

      if (typeof newUserId !== 'string' || newUserId === '') return;

      // ────────────────────────────────────────────────────────────────────────
      // Case 1: User switch detected (different user authenticating)
      // ────────────────────────────────────────────────────────────────────────
      if (state.userId && state.userId !== newUserId) {
        Logger.info('[LOCATION] User switch detected - clearing old location', {
          oldUserId: state.userId,
          newUserId,
        });
        Object.assign(state, initialState);
        state.userId = newUserId;
        return;
      }

      // ────────────────────────────────────────────────────────────────────────
      // Case 2: Same user or first login with no existing location
      // ────────────────────────────────────────────────────────────────────────
      state.userId = newUserId;
      Logger.info('[LOCATION] User authenticated - location preserved', {
        userId: newUserId,
        hasLocation: !!state.coordinates,
        source: action.type,
      });
    });

    // On logout: keep userId AND location data for re-login detection
    // This allows Case 1 (user switch) to properly detect when a DIFFERENT
    // user logs in after the previous user was deleted or switched accounts.
    //
    // Flow: User A logs out → userId stays "A" → User B logs in →
    //   Case 1 detects "A" !== "B" → clears location → shows prompt
    //
    // Flow: User A logs out → userId stays "A" → User A logs in →
    //   Case 3: same userId → keeps location → no prompt
    builder.addMatcher(isAuthLogoutAction, state => {
      Logger.info('[LOCATION] Logout - preserving userId for re-login detection', {
        userId: state.userId,
        hasLocation: !!state.coordinates,
      });
      // Do NOT clear userId - it's needed to detect user switches on next login
    });
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  setManualLocation,
  setPreferredRadius,
  dismissPrompt,
  resetPromptDismissal,
  clearLocation,
  clearError,
  clearAll: clearAllLocation,
} = locationSlice.actions;

export default locationSlice.reducer;

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select whether user has a valid location
 */
export const selectHasValidLocation = (state: { location: LocationState }): boolean =>
  state.location.coordinates !== null;

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
  const { hasPromptedForLocation, promptDismissedAt, permissionStatus, coordinates } =
    state.location;

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
 * Select location source display name (memoized)
 * ✅ PERFORMANCE: Memoized to prevent unnecessary re-renders
 */
export const selectLocationSourceDisplay = createSelector(
  [
    (state: { location: LocationState }) => state.location.source,
    (state: { location: LocationState }) => state.location.manualLocationName,
  ],
  (source, manualLocationName): { mode: 'gps' | 'manual' | 'off'; label: string } => {
    if (source === 'gps') {
      return { mode: 'gps', label: 'Using GPS' };
    }
    if (source === 'manual' && manualLocationName) {
      return { mode: 'manual', label: manualLocationName };
    }
    return { mode: 'off', label: 'Location off' };
  },
);

/**
 * Select formatted display location for header (memoized)
 *
 * ✅ PRODUCTION-GRADE SELECTOR
 * - Handles null/undefined safely with runtime type guards
 * - Truncates long names (> 20 chars) for UI consistency
 * - Returns presentation-ready string (never null/undefined)
 * - Memoized to prevent unnecessary component re-renders
 * - Includes validation logging for debugging rehydration issues
 *
 * **Why this approach?**
 * - Components should consume presentation-ready data from selectors
 * - Formatting logic centralized in one place (DRY principle)
 * - Prevents race conditions during AsyncStorage rehydration
 * - Type-safe: always returns string, never crashes on undefined
 *
 * **Rehydration safety:**
 * - During rehydration, coordinates may load before location names
 * - This selector defensively checks BOTH coordinates AND names
 * - Falls back to safe defaults instead of crashing
 *
 * @returns Formatted location string ready for display
 */
export const selectFormattedLocationDisplay = createSelector(
  [
    (state: { location: LocationState }) => state.location.coordinates,
    (state: { location: LocationState }) => state.location.source,
    (state: { location: LocationState }) => state.location.manualLocationName,
    (state: { location: LocationState }) => state.location.gpsLocationName,
  ],
  (coordinates, source, manualLocationName, gpsLocationName): string => {
    // ────────────────────────────────────────────────────────────────────────
    // 1. NO LOCATION - Return prompt
    // ────────────────────────────────────────────────────────────────────────
    if (!coordinates) {
      return 'Set your location';
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. GPS LOCATION
    // ────────────────────────────────────────────────────────────────────────
    if (source === 'gps') {
      // Runtime type guard - ensure gpsLocationName is a valid non-empty string
      if (typeof gpsLocationName === 'string' && gpsLocationName.trim().length > 0) {
        const trimmed = gpsLocationName.trim();
        // Truncate if > 20 characters
        return trimmed.length > 20 ? `${trimmed.substring(0, 20)}...` : trimmed;
      }

      // Fallback during reverse geocoding or if name is null/undefined
      return 'Current Location';
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. MANUAL LOCATION
    // ────────────────────────────────────────────────────────────────────────

    // Runtime type guard - ensure manualLocationName is a valid non-empty string
    if (typeof manualLocationName === 'string' && manualLocationName.trim().length > 0) {
      const trimmed = manualLocationName.trim();
      // Truncate if > 20 characters
      return trimmed.length > 20 ? `${trimmed.substring(0, 20)}...` : trimmed;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. INCONSISTENT STATE - Coordinates exist but no name
    // This can happen during:
    // - AsyncStorage rehydration (coordinates load before name)
    // - State corruption
    // - Migration from old app version
    // ────────────────────────────────────────────────────────────────────────

    Logger.warn('[selectFormattedLocationDisplay] Inconsistent state detected', {
      hasCoordinates: coordinates !== null && coordinates !== undefined,
      source,
      manualLocationName: manualLocationName === null ? 'null' : typeof manualLocationName,
      gpsLocationName: gpsLocationName === null ? 'null' : typeof gpsLocationName,
      context: 'Coordinates exist but no valid location name - possible rehydration race',
    });

    return 'Set your location';
  },
);
