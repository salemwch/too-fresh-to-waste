/**
 * Development-only location seeding.
 *
 * WHY
 * ---
 * `LocationSelectionModal` is presented over the tab navigator whenever
 * `location.coordinates` is null, with a scrim that swallows taps on the tab
 * bar. On an emulator neither of its two exits completes - BlueStacks has no
 * GPS fix, and the manual city search needs a geocoding backend - so ten
 * authenticated screens sat behind a modal that could not be dismissed. That
 * was the single blocker recorded in §20 of
 * MOBILE_LIGHT_DEVICE_VERIFICATION_REPORT.md.
 *
 * WHAT IT DOES
 * ------------
 * Dispatches `setManualLocation` - **the same action the real city-search flow
 * dispatches** - once the store has rehydrated. Nothing else. There is no
 * parallel state shape, no direct MMKV write, and no new reducer:
 *
 *   - the payload is the slice's own `{ coordinates: LocationCoordinates, name }`
 *   - the reducer sets `source: 'manual'` and clears the GPS cache, exactly as
 *     it does for a real manual selection
 *   - redux-persist writes it through the existing `locationTransform`, which
 *     strips only `error` and `isLoading`
 *
 * From the app's point of view a user picked Tunis from the city list.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not touch location *authorization*. `permissionStatus` is untouched,
 * no permission is granted or faked, and the production GPS path is unchanged.
 * A real build still asks for permission and still reads a real fix.
 *
 * IT WILL NOT OVERWRITE A REAL CHOICE
 * -----------------------------------
 * If coordinates are already present - because a previous run seeded them, or
 * because someone actually picked a city - it does nothing. The seed is for an
 * empty slice, not a reset button.
 *
 * GATES
 * -----
 * The same three as `devSession.ts`, via the same predicate: a development
 * build, an explicit `ENABLE_DEV_AUTH=true`, and an API base URL on localhost.
 * Gate 3 is what makes the other two survivable - this cannot run in a build
 * that can reach a real backend.
 */

import Config from 'react-native-config';

import { environment } from '@/config/environment';
import { setManualLocation } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';

import { devSessionBlockedReason } from './devSession';

/**
 * Tunis city centre. Matches the coordinates `tools/dev-mock-api/server.mjs`
 * returns from `POST /geolocation/geocode`, so the seeded location and the
 * mock's offers describe the same place.
 */
export const DEV_LOCATION = {
  coordinates: { latitude: 36.8065, longitude: 10.1815 },
  name: 'Tunis, Tunisia',
} as const;

/** The slice surface this needs, kept narrow so a test can supply a fake. */
export interface SeedableStore {
  getState: () => {
    location?: { coordinates: unknown };
    _persist?: { rehydrated?: boolean };
  };
  dispatch: (action: unknown) => unknown;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Seeds a manual location once the store has rehydrated.
 *
 * Returns an unsubscribe function. Safe to call unconditionally: it is a no-op
 * when any gate fails, and it never throws into the caller.
 */
export function seedDevLocationIfEnabled(store: SeedableStore): () => void {
  const noop = (): void => undefined;

  const blocked = devSessionBlockedReason(
    __DEV__,
    Config['ENABLE_DEV_AUTH'],
    environment.api.baseUrl,
  );

  if (blocked !== null) return noop;

  /**
   * Returns true when there is nothing left to wait for, so the caller can
   * stop listening.
   *
   * Rehydration is the reason this is a subscription rather than a single
   * dispatch. redux-persist replaces the slice wholesale when REHYDRATE lands;
   * seeding before that would be silently overwritten by the empty persisted
   * value, which is the failure this function exists to avoid.
   */
  const attempt = (): boolean => {
    let state;
    try {
      state = store.getState();
    } catch {
      return false;
    }

    if (state._persist?.rehydrated !== true) return false;

    if (state.location?.coordinates != null) {
      Logger.info('[DEV-LOCATION] Location already set, leaving it alone');
      return true;
    }

    store.dispatch(
      setManualLocation({
        coordinates: { ...DEV_LOCATION.coordinates },
        name: DEV_LOCATION.name,
      }),
    );
    Logger.warn(
      '[DEV-LOCATION] Seeded a manual location so the location modal does not ' +
        'gate the authenticated screens. Permission state is untouched.',
      { name: DEV_LOCATION.name, api: environment.api.baseUrl },
    );
    return true;
  };

  // Rehydration may already have finished before this runs.
  if (attempt()) return noop;

  let unsubscribe: (() => void) | null = null;
  const listener = (): void => {
    if (attempt()) {
      unsubscribe?.();
      unsubscribe = null;
    }
  };

  unsubscribe = store.subscribe(listener);
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
