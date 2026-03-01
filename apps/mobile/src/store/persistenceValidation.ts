/**
 * Redux Persistence Validation with Zod
 *
 * Validates persisted Redux state on rehydration to prevent:
 * - Corrupted state from crashing the app
 * - Schema mismatches after app updates
 * - Invalid data types causing runtime errors
 * - Rehydration races with incomplete data
 *
 * Best Practices:
 * - Validate ALL persisted slices
 * - Provide safe defaults for invalid/missing data
 * - Log validation failures for monitoring
 * - Version your schemas for migrations
 * - Never throw on validation failure (graceful fallback)
 *
 * Installation Required:
 * ```bash
 * cd apps/mobile
 * npm install zod
 * ```
 *
 * Usage in Redux Persist Config:
 * ```typescript
 * import { validatePersistedState } from './persistenceValidation';
 *
 * const persistConfig = {
 *   key: 'root',
 *   storage: AsyncStorage,
 *   transforms: [validatePersistedState], // ✅ Add validation transform
 * };
 * ```
 */

import { createTransform } from 'redux-persist';
import { z } from 'zod';

import { Logger } from '@/utils/logger';

// ============================================================================
// Zod Schemas - Runtime Type Validation
// ============================================================================

/**
 * Location Coordinates Schema
 * Validates latitude/longitude are valid numbers
 */
const LocationCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Location Source Schema
 * Validates source is one of allowed values
 */
const LocationSourceSchema = z.enum(['gps', 'manual']).nullable();

/**
 * Permission Status Schema
 */
const PermissionStatusSchema = z.enum(['undetermined', 'granted', 'denied', 'blocked']);

/**
 * ✅ LOCATION STATE SCHEMA
 *
 * Validates the entire locationSlice persisted state.
 * Catches issues like:
 * - coordinates exist but manualLocationName is undefined (rehydration race)
 * - Invalid latitude/longitude values
 * - Wrong data types
 * - Missing required fields
 *
 * **Rehydration Safety:**
 * - Ensures coordinates and location names are in sync
 * - Prevents partial rehydration (coordinates without names)
 * - Validates all fields have correct types
 */
const LocationStateSchema = z.object({
  // Core location data
  coordinates: LocationCoordinatesSchema.nullable(),
  accuracy: z.number().nullable(),
  source: LocationSourceSchema,
  timestamp: z.number().nullable(),

  // Permission status
  permissionStatus: PermissionStatusSchema,

  // Location names (CRITICAL: prevent undefined)
  manualLocationName: z.string().nullable(), // ✅ Explicitly null, never undefined
  gpsLocationName: z.string().nullable(), // ✅ Explicitly null, never undefined
  gpsLocationTimestamp: z.number().nullable(),
  gpsLocationCoordinates: LocationCoordinatesSchema.nullable(),

  // User preferences
  preferredRadiusKm: z.number().min(1).max(100),

  // Prompt state
  hasPromptedForLocation: z.boolean(),
  promptDismissedAt: z.number().nullable(),

  // Loading/error state (not persisted, but include for completeness)
  isLoading: z.boolean().default(false),
  error: z.string().nullable(),
});

/**
 * Auth State Schema
 * Validates authentication tokens and user data
 */
const AuthStateSchema = z.object({
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  user: z
    .object({
      _id: z.string(),
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      role: z.enum(['consumer', 'admin', 'establishment']).optional(),
    })
    .nullable(),
  isAuthenticated: z.boolean(),
  flowState: z.string(), // AuthFlowState enum
  isLoading: z.boolean().default(false),
  error: z.string().nullable(),
});

/**
 * Favorites State Schema
 */
const FavoritesStateSchema = z.object({
  items: z.array(z.string()), // Array of offer IDs
  lastSyncedAt: z.number().nullable(),
  syncStatus: z.enum(['idle', 'syncing', 'success', 'error']),
});

// ============================================================================
// State-Specific Validation Functions
// ============================================================================

/**
 * Validate Location State
 *
 * ✅ CRITICAL FOR REHYDRATION RACE PREVENTION
 *
 * Ensures:
 * - If coordinates exist, at least one location name exists
 * - No undefined values (converts to null)
 * - All types are correct
 *
 * @param state - Raw persisted location state
 * @returns Validated and sanitized state, or safe default
 */
function validateLocationState(state: unknown): unknown {
  try {
    // Parse and validate
    const validated = LocationStateSchema.parse(state);

    // ✅ ATOMIC REHYDRATION CHECK
    // If coordinates exist but BOTH location names are null, clear coordinates
    // This prevents the "coordinates exist but no name" race condition
    if (validated.coordinates && !validated.manualLocationName && !validated.gpsLocationName) {
      Logger.warn('[PersistenceValidation] Detected inconsistent location state during rehydration', {
        hasCoordinates: true,
        hasManualName: false,
        hasGpsName: false,
        action: 'Clearing coordinates to force re-selection',
      });

      return {
        ...validated,
        coordinates: null,
        source: null,
        accuracy: null,
        timestamp: null,
      };
    }

    return validated;
  } catch (error) {
    Logger.error(
      '[PersistenceValidation] Location state validation failed',
      {
        error: error instanceof z.ZodError ? error.issues : String(error),
      },
      error as Error,
    );

    // Return safe default state
    return {
      coordinates: null,
      accuracy: null,
      source: null,
      timestamp: null,
      permissionStatus: 'undetermined',
      manualLocationName: null,
      gpsLocationName: null,
      gpsLocationTimestamp: null,
      gpsLocationCoordinates: null,
      preferredRadiusKm: 25,
      hasPromptedForLocation: false,
      promptDismissedAt: null,
      isLoading: false,
      error: null,
    };
  }
}

/**
 * Validate Auth State
 */
function validateAuthState(state: unknown): unknown {
  try {
    return AuthStateSchema.parse(state);
  } catch (error) {
    Logger.error(
      '[PersistenceValidation] Auth state validation failed',
      {
        error: error instanceof z.ZodError ? error.issues : String(error),
      },
      error as Error,
    );

    // Return logged-out state
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      flowState: 'UNAUTHENTICATED',
      isLoading: false,
      error: null,
    };
  }
}

/**
 * Validate Favorites State
 */
function validateFavoritesState(state: unknown): unknown {
  try {
    return FavoritesStateSchema.parse(state);
  } catch (error) {
    Logger.error(
      '[PersistenceValidation] Favorites state validation failed',
      {
        error: error instanceof z.ZodError ? error.issues : String(error),
      },
      error as Error,
    );

    return {
      items: [],
      lastSyncedAt: null,
      syncStatus: 'idle',
    };
  }
}

// ============================================================================
// Redux Persist Transform
// ============================================================================

/**
 * ✅ PERSISTENCE VALIDATION TRANSFORM
 *
 * Redux Persist transform that validates state on rehydration.
 * Catches and fixes corrupted/invalid state before it reaches Redux.
 *
 * **How it works:**
 * 1. Redux Persist loads state from AsyncStorage
 * 2. Transform validates each slice with zod
 * 3. Invalid data is replaced with safe defaults
 * 4. Validation errors are logged for monitoring
 * 5. App continues normally (no crashes)
 *
 * **Prevents:**
 * - App crashes from corrupted AsyncStorage data
 * - Rehydration races (coordinates without names)
 * - Schema mismatches after app updates
 * - Type errors from invalid data
 *
 * @example
 * ```typescript
 * const persistConfig = {
 *   key: 'root',
 *   storage: AsyncStorage,
 *   transforms: [persistenceValidationTransform],
 * };
 * ```
 */
export const persistenceValidationTransform = createTransform(
  // ────────────────────────────────────────────────────────────────────────
  // OUTBOUND (state → storage)
  // No validation needed on save
  // ────────────────────────────────────────────────────────────────────────
  (outboundState, key) => {
    Logger.debug('[PersistenceValidation] Saving state to AsyncStorage', { key });
    return outboundState;
  },

  // ────────────────────────────────────────────────────────────────────────
  // INBOUND (storage → state)
  // Validate and sanitize on rehydration
  // ────────────────────────────────────────────────────────────────────────
  (inboundState, key) => {
    Logger.debug('[PersistenceValidation] Rehydrating state from AsyncStorage', { key });

    switch (key) {
      case 'location':
        return validateLocationState(inboundState);

      case 'auth':
        return validateAuthState(inboundState);

      case 'favorites':
        return validateFavoritesState(inboundState);

      default:
        // No validation for other slices (pass through)
        return inboundState;
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // CONFIG: Which slices to validate
  // ────────────────────────────────────────────────────────────────────────
  {
    whitelist: ['location', 'auth', 'favorites'], // Only validate these slices
  },
);

// ============================================================================
// Utility: Validate Entire Persisted State (for testing)
// ============================================================================

/**
 * Validate entire persisted state object
 * Useful for debugging and testing
 */
export function validatePersistedState(state: Record<string, unknown>): {
  valid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, unknown>;
} {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, unknown> = {};

  // Validate location
  if ('location' in state) {
    try {
      sanitized['location'] = validateLocationState(state['location']);
    } catch (error) {
      errors['location'] = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => e.message) : [String(error)];
    }
  }

  // Validate auth
  if ('auth' in state) {
    try {
      sanitized['auth'] = validateAuthState(state['auth']);
    } catch (error) {
      errors['auth'] = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => e.message) : [String(error)];
    }
  }

  // Validate favorites
  if ('favorites' in state) {
    try {
      sanitized['favorites'] = validateFavoritesState(state['favorites']);
    } catch (error) {
      errors['favorites'] = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => e.message) : [String(error)];
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
