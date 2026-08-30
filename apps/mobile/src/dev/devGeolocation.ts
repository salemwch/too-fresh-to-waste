/**
 * Development-only geolocation fixture.
 *
 * WHY
 * ---
 * `DriverOrdersListScreen` does not read the persisted location slice. It calls
 * `Geolocation.watchPosition` directly and holds the result in local state,
 * gating the available-orders list on `hasCoords && isOnline && !activeOrder`.
 * On BlueStacks that watcher never fires - there is no GPS - so the screen sits
 * on "Locating you… / Acquiring GPS signal" forever and
 * `DriverOrderDetailScreen`, which is only reachable by tapping an available
 * order, cannot be opened at all.
 *
 * `devLocation.ts` does not help here: it seeds the *stored consumer* location
 * through `setManualLocation`, which is a different code path entirely.
 *
 * Every emulator-side route was tried first and none work on this rig:
 * `adb emu geo fix` (BlueStacks is not an AVD, so there is no emulator
 * console), `appops … android:mock_location` (accepted, but needs a mock
 * provider app to actually push fixes), and `cmd location` (not implemented on
 * API 28).
 *
 * WHAT IT DOES
 * ------------
 * Replaces two methods on the geolocation module with implementations that
 * return one fixed position - the same Tunis coordinates `devLocation.ts` seeds
 * and the mock API geocodes to, so the whole verification environment agrees on
 * where the device is.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It changes no production file and no production behaviour. `DriverOrdersList`
 * still calls `watchPosition`, still handles permissions itself, still gates on
 * `coords`, and still renders its own loading and error branches. The GPS logic
 * is untouched; only what the module hands back in the dev verification
 * environment is fixed.
 *
 * The permission flow is deliberately left alone. `request()` from
 * `react-native-permissions` is not patched, so the driver screen still asks
 * for permission and still routes to its denied and blocked branches for real.
 *
 * GATES
 * -----
 * The same three as the rest of `src/dev`, through the same predicate:
 * `__DEV__`, `ENABLE_DEV_AUTH === 'true'`, and a localhost API. In a release
 * build `__DEV__` is a compile-time `false`, so the entry point never even
 * requires this module.
 */

import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';

import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';

import { DEV_LOCATION } from './devLocation';
import { devSessionBlockedReason } from './devSession';

/** How often the fake watcher re-emits, mirroring a real watch's cadence. */
const EMIT_INTERVAL_MS = 10_000;

/**
 * A `GeolocationResponse`-shaped fix at the same coordinates the rest of the
 * dev environment uses. Accuracy and speed are plausible rather than perfect -
 * nothing under test reads them.
 */
export const devPosition = () => ({
  coords: {
    latitude: DEV_LOCATION.coordinates.latitude,
    longitude: DEV_LOCATION.coordinates.longitude,
    accuracy: 12,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    speed: 0,
  },
  timestamp: Date.now(),
});

/** The minimal surface this patches, so a test can supply a fake. */
export interface PatchableGeolocation {
  watchPosition: (
    success: (position: ReturnType<typeof devPosition>) => void,
    error?: (e: unknown) => void,
    options?: unknown,
  ) => number;
  clearWatch: (watchId: number) => void;
  getCurrentPosition: (
    success: (position: ReturnType<typeof devPosition>) => void,
    error?: (e: unknown) => void,
    options?: unknown,
  ) => void;
}

let restore: (() => void) | null = null;

/**
 * Patches the module in place when every gate holds. Returns a function that
 * puts the originals back, or a no-op when nothing was patched.
 *
 * Idempotent: calling it twice does not stack patches or leak timers.
 */
export function seedDevGeolocationIfEnabled(
  target: PatchableGeolocation = Geolocation as unknown as PatchableGeolocation,
): () => void {
  const noop = (): void => undefined;

  const blocked = devSessionBlockedReason(
    __DEV__,
    Config['ENABLE_DEV_AUTH'],
    environment.api.baseUrl,
  );
  if (blocked !== null) return noop;

  // Already patched - hand back the existing restore rather than wrapping the
  // wrapper, which would make the originals unrecoverable.
  if (restore !== null) return restore;

  const originalWatch = target.watchPosition;
  const originalClear = target.clearWatch;
  const originalGet = target.getCurrentPosition;

  const timers = new Map<number, ReturnType<typeof setInterval>>();
  let nextId = 1;

  target.watchPosition = (success, _error, _options) => {
    const id = nextId++;
    // Emit once immediately so the screen leaves its loading branch without
    // waiting a full interval, then keep emitting like a real watch.
    success(devPosition());
    timers.set(
      id,
      setInterval(() => {
        success(devPosition());
      }, EMIT_INTERVAL_MS),
    );
    return id;
  };

  target.clearWatch = id => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearInterval(timer);
      timers.delete(id);
    }
  };

  target.getCurrentPosition = (success, _error, _options) => {
    success(devPosition());
  };

  Logger.warn(
    '[DEV-GEO] Geolocation is returning a fixed development position so the ' +
      'driver flow can be reached on an emulator with no GPS. Permission ' +
      'handling is untouched.',
    { ...DEV_LOCATION.coordinates, api: environment.api.baseUrl },
  );

  restore = () => {
    timers.forEach(t => {
      clearInterval(t);
    });
    timers.clear();
    target.watchPosition = originalWatch;
    target.clearWatch = originalClear;
    target.getCurrentPosition = originalGet;
    restore = null;
  };

  return restore;
}

/** Test seam: forgets that a patch was applied. */
export function resetDevGeolocationForTests(): void {
  restore = null;
}
