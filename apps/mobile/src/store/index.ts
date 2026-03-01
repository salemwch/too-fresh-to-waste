import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import { environment } from '@/config/environment';
import authReducer from '@/features/auth/store/authSlice';
import favoritesReducer from '@/store/slices/favoritesSlice';
import locationReducer from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';
import { mmkvStorage, isMMKVAvailable } from '@/utils/mmkvStorage'; // ✅ Smart storage with fallback

import { authSessionMiddleware } from './middleware/authSessionMiddleware';

// Root reducer combining all feature reducers
const rootReducer = combineReducers({
  auth: authReducer,
  location: locationReducer,
  favorites: favoritesReducer,
  // Add other feature reducers here as they are created
  // offers: offersReducer,
  // orders: ordersReducer,
  // profile: profileReducer,
});

// Derive RootState from rootReducer BEFORE persist wrapper
// This ensures state.auth is never typed as undefined
type RootStateFromReducer = ReturnType<typeof rootReducer>;

// Transform to exclude transient UI state from persistence
const authTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    const { isLoading, error, ...rest } = inboundState;
    // ✅ PRODUCTION: Don't persist tokens in MMKV
    // Tokens are ONLY in Keychain (SecureStorage) - MMKV is UI cache only
    // We still persist them for warm reload UX, but they're NOT authoritative
    return rest;
  },
  // Transform state being rehydrated
  (outboundState: any) =>
    // Restore default values for transient state on rehydration
    ({
      ...outboundState,
      isLoading: false,
      error: undefined,
    }),
  // Specify which reducers this transform applies to
  { whitelist: ['auth'] },
);

// Transform to exclude transient state from location slice persistence
const locationTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    const { isLoading, error, ...rest } = inboundState;
    // Don't persist isLoading and error - these are transient UI state
    return rest;
  },
  // Transform state being rehydrated
  (outboundState: any) =>
    // Restore default values for transient state on rehydration
    ({
      ...outboundState,
      isLoading: false,
      error: null,
    }),
  // Specify which reducers this transform applies to
  { whitelist: ['location'] },
);

// Transform to exclude transient state from favorites slice persistence
const favoritesTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    const { isLoading, error, ...rest } = inboundState;
    // Don't persist isLoading and error - these are transient UI state
    return rest;
  },
  // Transform state being rehydrated
  (outboundState: any) =>
    // Restore default values for transient state on rehydration
    ({
      ...outboundState,
      isLoading: false,
      error: null,
    }),
  // Specify which reducers this transform applies to
  { whitelist: ['favorites'] },
);

// ✅ PRODUCTION: Redux Persist configuration with MMKV
// MMKV is 10-100x faster than AsyncStorage, encrypted by default
// IMPORTANT: MMKV is UI CACHE ONLY - NOT authoritative for auth
// Authoritative auth data is in Keychain (SecureStorage)
const persistConfig = {
  key: 'root',
  storage: mmkvStorage, // ✅ Changed from AsyncStorage to MMKV
  whitelist: ['auth', 'location', 'favorites'], // Persist for fast UI
  blacklist: [],
  transforms: [authTransform, locationTransform, favoritesTransform],
  // MMKV-specific optimizations
  timeout: 1000, // Fast timeout since MMKV is synchronous under the hood
  writeFailHandler: (error: Error) => {
    Logger.error('[Redux Persist] MMKV write failed', {}, error);
  },
};

// Cast to fix redux-persist type inference with transforms
// The `as any` is needed because redux-persist's types don't handle transforms well
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const persistedReducer = persistReducer(persistConfig, rootReducer as any) as typeof rootReducer;

// Configure store with proper middleware
// Note: preloadedState omitted for exactOptionalPropertyTypes compliance
export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      // Auth Session Middleware (Production-grade session management)
      // - Proactive token refresh BEFORE expiry
      // - Automatic logout on expired tokens
      // - Runs in pure JS/TS (no React bridge overhead)
      // - Survives navigation stack changes
      authSessionMiddleware,
    ),
  devTools: __DEV__ && environment.shouldEnableDebugging,
});

export const persistor = persistStore(store, null, () => {
  const backend = isMMKVAvailable() ? 'MMKV' : 'AsyncStorage';
  const state = store.getState();

  // ✅ DEBUG: Log persisted location state after rehydration
  Logger.info(`[Redux Persist] Rehydration complete using ${backend}`, {
    backend,
    isMMKV: isMMKVAvailable(),
    // Location state debug info
    location: {
      hasCoordinates: !!state.location.coordinates,
      coordinates: state.location.coordinates,
      source: state.location.source,
      manualLocationName: state.location.manualLocationName,
      gpsLocationName: state.location.gpsLocationName,
      userId: state.location.userId, // ⚠️ Check if this matches current logged-in user
      timestamp: state.location.timestamp,
      hasPromptedForLocation: state.location.hasPromptedForLocation,
    },
    // Auth state debug info (for userId comparison)
    auth: {
      isAuthenticated: state.auth.isAuthenticated,
      userId: state.auth.user?.userId,
      email: state.auth.user?.email,
    },
  });

  // ⚠️ CRITICAL: Check for user ID mismatch (data leak detection)
  if (
    state.location.userId &&
    state.auth.user?.userId &&
    state.location.userId !== state.auth.user.userId
  ) {
    Logger.warn('[Redux Persist] ⚠️ USER ID MISMATCH DETECTED - Location belongs to different user!', {
      locationUserId: state.location.userId,
      currentUserId: state.auth.user.userId,
      shouldClearLocation: true,
    });
  }
});

// Types for TypeScript
// Use RootStateFromReducer to avoid Partial<> wrapper from persistReducer
// This ensures state.auth is correctly typed as AuthState (not AuthState | undefined)
export type RootState = RootStateFromReducer;
// Explicit dispatch type to break the circular reference between store.dispatch and authSessionMiddleware
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
export type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
export type AppStore = typeof store;

// Store cleanup utility
export const clearPersistedStore = async (): Promise<void> => {
  try {
    await persistor.purge();
    Logger.info('[Redux Persist] MMKV cache cleared');
  } catch (error) {
    Logger.error('[Redux Persist] Failed to clear MMKV cache', {}, error as Error);
  }
};

// Store reset utility
export const resetStore = (): void => {
  store.dispatch({ type: 'RESET_STORE' });
  Logger.info('[Redux] Store reset to initial state');
};

/**
 * 🔧 DEBUG UTILITY: Clear persisted location data
 *
 * Use this to test location persistence behavior or clear stale location data.
 *
 * Usage in React Native Debugger console:
 * ```
 * require('./src/store/index').clearPersistedLocation()
 * ```
 *
 * Or add a button in your app (dev mode only):
 * ```tsx
 * import { clearPersistedLocation } from '@/store';
 * <Button onPress={clearPersistedLocation}>Clear Location</Button>
 * ```
 */
export const clearPersistedLocation = (): void => {
  const { clearAllLocation } = require('@/store/slices/locationSlice');
  store.dispatch(clearAllLocation());
  Logger.info('[Redux] Persisted location data cleared', {
    coordinates: store.getState().location.coordinates,
    userId: store.getState().location.userId,
  });
};

// Development utilities
if (__DEV__) {
  // Global store access for debugging
  (global as any).__STORE__ = store;

  // Log store state changes in development
  store.subscribe(() => {
    if (environment.debug.enableReduxLogging) {
      console.log('Store state updated:', store.getState());
    }
  });
}
