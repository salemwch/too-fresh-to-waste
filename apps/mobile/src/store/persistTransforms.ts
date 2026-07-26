/**
 * redux-persist transforms.
 *
 * Split out of store/index.ts so these can be tested without booting the store:
 * importing store/index.ts runs configureStore + persistStore at module scope,
 * which drags in the session middleware and MMKV.
 */

import { createTransform } from 'redux-persist';

import type { LocationState } from '@/store/slices/locationSlice';

import type { AuthState } from '@/features/auth/types';

interface TransientSliceState<TError> {
  error: TError;
  isLoading: boolean;
}

type PersistedSlice<TState extends TransientSliceState<unknown>> = Omit<
  TState,
  'error' | 'isLoading'
>;

interface RootPersistState {
  auth: AuthState;
  location: LocationState;
}

/**
 * @param runtimeDefaults per-run flags: stripped on write, forced on read.
 */
export const createTransientStateTransform = <TState extends TransientSliceState<unknown>>(
  reducerKey: keyof RootPersistState,
  errorValue: TState['error'],
  runtimeDefaults: Partial<TState> = {},
) =>
  createTransform<TState, PersistedSlice<TState>, RootPersistState, RootPersistState>(
    inboundState => {
      const { error: _error, isLoading: _isLoading, ...rest } = inboundState;
      for (const key of Object.keys(runtimeDefaults)) {
        delete (rest as Record<string, unknown>)[key];
      }
      return rest;
    },
    outboundState =>
      ({
        ...outboundState,
        isLoading: false,
        error: errorValue,
        // Applied unconditionally, so devices already holding a stale `true`
        // from before this fix are corrected on their next launch — no
        // PERSIST_VERSION bump needed.
        ...runtimeDefaults,
      }) as TState,
    { whitelist: [reducerKey as string] },
  );

/**
 * Auth carries two flags describing what *this launch* has done, not durable
 * session state:
 *
 *   isUserSynced        — has /auth/me confirmed the user yet this run
 *   isRecoveringSession — is post-resume token recovery in flight
 *
 * Persisting `isUserSynced` was a live bug. It rehydrated as `true`, so
 * ProtectedRoute ran its email-verification gate against the stale Keychain copy
 * before any sync had happened. Someone who verified on another device was shown
 * "Email Verification Required" — the exact case the flag exists to prevent.
 * Its own comment in types/index.ts says as much; persistence quietly defeated it.
 *
 * It also let useCurrentUser fire before the middleware's cold-start sync,
 * making two /auth/me requests per launch instead of one.
 */
export const authTransform = createTransientStateTransform<AuthState>('auth', undefined, {
  isUserSynced: false,
  isRecoveringSession: false,
});

export const locationTransform = createTransientStateTransform<LocationState>('location', null);
