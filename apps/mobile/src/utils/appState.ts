import { AppState, type AppStateStatus } from 'react-native';

/**
 * React Native 0.87 types `AppState.currentState` as `?string`: it is null until
 * the native module has reported a state. Code that stores it as an
 * AppStateStatus must therefore narrow it, or call string methods on null.
 */
const APP_STATE_STATUSES: ReadonlySet<string> = new Set<AppStateStatus>([
  'active',
  'background',
  'inactive',
  'unknown',
  'extension',
]);

export const isAppStateStatus = (state: string): state is AppStateStatus =>
  APP_STATE_STATUSES.has(state);

/** A raw AppState value as an AppStateStatus, or null when it is absent or unrecognised. */
export const toAppStateStatus = (state: string | null | undefined): AppStateStatus | null =>
  state != null && isAppStateStatus(state) ? state : null;

/** AppState.currentState as an AppStateStatus, or null before RN has reported one. */
export const readAppState = (): AppStateStatus | null => toAppStateStatus(AppState.currentState);
