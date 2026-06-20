import {
  combineReducers,
  configureStore,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  createTransform,
  persistReducer,
  persistStore,
} from 'redux-persist';

import { environment } from '@/config/environment';
import authReducer from '@/features/auth/store/authSlice';
import favoritesReducer from '@/store/slices/favoritesSlice';
import locationReducer from '@/store/slices/locationSlice';
import type { LocationState } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';
import { isMMKVAvailable, mmkvStorage } from '@/utils/mmkvStorage';

import { authSessionMiddleware } from './middleware/authSessionMiddleware';
import { setAppStore } from './storeAccessor';

import type { AuthState } from '@/features/auth/types';
import type { FavoritesState } from '@/store/slices/favoritesSlice';

interface TransientSliceState<TError> {
  error: TError;
  isLoading: boolean;
}

type PersistedSlice<TState extends TransientSliceState<unknown>> = Omit<
  TState,
  'error' | 'isLoading'
>;

const rootReducer = combineReducers({
  auth: authReducer,
  location: locationReducer,
  favorites: favoritesReducer,
});

type RootStateFromReducer = ReturnType<typeof rootReducer>;

const createTransientStateTransform = <TState extends TransientSliceState<unknown>>(
  reducerKey: keyof RootStateFromReducer,
  errorValue: TState['error'],
) =>
  createTransform<TState, PersistedSlice<TState>, RootStateFromReducer, RootStateFromReducer>(
    inboundState => {
      const { error: _error, isLoading: _isLoading, ...rest } = inboundState;
      return rest;
    },
    outboundState =>
      ({
        ...outboundState,
        isLoading: false,
        error: errorValue,
      }) as TState,
    { whitelist: [reducerKey as string] },
  );

const authTransform = createTransientStateTransform<AuthState>('auth', undefined);
const favoritesTransform = createTransientStateTransform<FavoritesState>('favorites', null);
const locationTransform = createTransientStateTransform<LocationState>('location', null);

const persistConfig = {
  key: 'root',
  storage: mmkvStorage,
  whitelist: ['auth', 'favorites', 'location'],
  blacklist: [],
  transforms: [authTransform, favoritesTransform, locationTransform],
  timeout: 1000,
  writeFailHandler: (error: Error) => {
    Logger.error('[Redux Persist] MMKV write failed', {}, error);
  },
};

const persistedReducer = persistReducer<RootStateFromReducer>(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(authSessionMiddleware),
  devTools: __DEV__ && environment.shouldEnableDebugging,
});

setAppStore(store);

export const persistor = persistStore(store, undefined, () => {
  const backend = isMMKVAvailable() ? 'MMKV' : 'AsyncStorage';
  const state = store.getState();

  Logger.info(`[Redux Persist] Rehydration complete using ${backend}`, {
    backend,
    isMMKV: isMMKVAvailable(),
    auth: {
      email: state.auth.user?.email,
      isAuthenticated: state.auth.isAuthenticated,
      userId: state.auth.user?.userId,
    },
    location: {
      coordinates: state.location.coordinates,
      gpsLocationName: state.location.gpsLocationName,
      hasCoordinates: state.location.coordinates !== null,
      hasPromptedForLocation: state.location.hasPromptedForLocation,
      manualLocationName: state.location.manualLocationName,
      source: state.location.source,
      timestamp: state.location.timestamp,
      userId: state.location.userId,
    },
  });

  if (
    state.location.userId &&
    state.auth.user?.userId &&
    state.location.userId !== state.auth.user.userId
  ) {
    Logger.warn('[Redux Persist] User ID mismatch detected for persisted location', {
      currentUserId: state.auth.user.userId,
      locationUserId: state.location.userId,
      shouldClearLocation: true,
    });
  }
});

export type RootState = RootStateFromReducer;
export type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
type AppStore = typeof store;

interface DebugGlobal {
  __STORE__?: AppStore;
}

if (__DEV__) {
  const debugGlobal = globalThis as typeof globalThis & DebugGlobal;
  debugGlobal.__STORE__ = store;

  store.subscribe(() => {
    if (environment.debug.enableReduxLogging) {
      Logger.debug(
        '[Redux] Store state updated',
        store.getState() as unknown as Record<string, unknown>,
      );
    }
  });
}
