import AsyncStorage from '@react-native-async-storage/async-storage';
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
// This prevents excessive re-renders when isLoading or error changes
const authTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    const { isLoading, error, ...rest } = inboundState;
    // Don't persist isLoading and error - these are transient UI state
    // that shouldn't trigger persistence and cause re-renders
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

// Redux Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'location', 'favorites'], // Persist auth, location, and favorites state
  blacklist: [], // Don't persist these reducers
  transforms: [authTransform, locationTransform, favoritesTransform], // Exclude transient state from persisted slices
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
      // Add additional middleware here
      // logger middleware only in development
      environment.debug.enableReduxLogging && __DEV__ ? [] : [],
    ),
  devTools: __DEV__ && environment.shouldEnableDebugging,
});

export const persistor = persistStore(store, null, () => {
  Logger.debug('Redux store rehydrated from persisted state');
});

// Types for TypeScript
// Use RootStateFromReducer to avoid Partial<> wrapper from persistReducer
// This ensures state.auth is correctly typed as AuthState (not AuthState | undefined)
export type RootState = RootStateFromReducer;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// Store cleanup utility
export const clearPersistedStore = async (): Promise<void> => {
  try {
    await persistor.purge();
    Logger.info('Persisted store cleared');
  } catch (error) {
    Logger.error('Failed to clear persisted store', {}, error as Error);
  }
};

// Store reset utility
export const resetStore = (): void => {
  store.dispatch({ type: 'RESET_STORE' });
  Logger.info('Store reset to initial state');
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
