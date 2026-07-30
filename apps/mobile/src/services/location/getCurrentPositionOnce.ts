/**
 * Process-wide serialized single-shot GPS request.
 *
 * Every caller that needs "one position, now" must go through this module.
 * Calling `Geolocation.getCurrentPosition` directly is a crash risk.
 *
 * Why
 * ---
 * `PlayServicesLocationManager` (@react-native-community/geolocation) stores the
 * single-shot `LocationCallback` in ONE shared instance field, and inside the
 * callback it unregisters via that field rather than via `this`:
 *
 *   mSingleLocationCallback = createSingleLocationCallback(...)   // every call
 *   mFusedLocationClient.removeLocationUpdates(mSingleLocationCallback)
 *   mSingleLocationCallback = null
 *
 * There is one manager instance per app, so ANY two overlapping single-shot
 * requests — from anywhere in the app — register two callbacks against that one
 * slot. The first delivery nulls the field; the second calls
 * `removeLocationUpdates(null)` and Play Services throws
 * `NullPointerException: Listener must not be null` on the main thread. The
 * process dies instantly, the task disappears, and Android surfaces whatever
 * was behind it — which for a Play Store install is the Play Store, so it reads
 * to the user as the app closing itself.
 *
 * That crash shipped in release 70 (two concurrent calls inside
 * `requestLocationAsync`), confirmed from logcat deobfuscated through
 * `app/build/outputs/mapping/productionRelease/mapping.txt` as
 * `PlayServicesLocationManager$2.onLocationResult`.
 *
 * Guarding here rather than at each call site is the point: there are four
 * independent callers (the location slice, the driver heartbeat, driver order
 * detail, checkout delivery pin) and none of them can know about the others.
 * A per-caller flag has to be repeated correctly in every one, and the caller
 * that forgets brings the crash back for everybody.
 *
 * Behaviour
 * ---------
 * - At most one native request is ever in flight.
 * - A caller arriving during an in-flight request JOINS it and receives the
 *   same fix (or the same failure). It does not queue a second request.
 * - Consequence, accepted deliberately: a joining caller's `options` are
 *   ignored, so it may get a fix acquired under someone else's accuracy
 *   settings. Every caller here wants "roughly where the device is now", and a
 *   slightly different accuracy is strictly better than a dead process.
 * - The request is bounded by a JS timer. The Play Services path ignores the
 *   `timeout` option entirely — it is parsed into `LocationOptions` and never
 *   read — so without this a request hangs until a fix arrives, which indoors
 *   can be never.
 */

import Geolocation from '@react-native-community/geolocation';

import { Logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface PositionFix {
  latitude: number;
  longitude: number;
  /** Metres. Play Services always reports this; kept required for callers. */
  accuracy: number;
}

/**
 * Mirrors the native error shape (`{ code, message }`) so existing callers can
 * keep mapping `code` to their own user-facing copy.
 *
 * Codes follow the W3C geolocation convention the library uses:
 * 1 = permission denied, 2 = position unavailable, 3 = timeout.
 */
export interface PositionFixError {
  code: number;
  message: string;
}

export interface PositionRequestOptions {
  enableHighAccuracy?: boolean;
  /** JS-enforced. The native Play Services path has no timeout of its own. */
  timeoutMs?: number;
  maximumAgeMs?: number;
  /** How eagerly the provider reports. Library default is 10 s, which is slow. */
  intervalMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAXIMUM_AGE_MS = 10 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 1_000;

/** Timeout uses code 3 to match the native convention callers already map. */
const TIMEOUT_ERROR_CODE = 3;

// ============================================================================
// Single-flight state
// ============================================================================

/**
 * The one request that may be in flight. Module scope on purpose: the native
 * constraint being protected is process-wide, so the guard has to be too.
 */
let inFlight: Promise<PositionFix> | null = null;

// ============================================================================
// Implementation
// ============================================================================

function requestFromNative(options: PositionRequestOptions): Promise<PositionFix> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<PositionFix>((resolve, reject) => {
    let settled = false;

    // Reads `timeoutId` from below. Safe: every caller of `settle` is a
    // callback that cannot run until this synchronous block has completed.
    const settle = (outcome: { fix: PositionFix } | { error: PositionFixError }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if ('fix' in outcome) {
        resolve(outcome.fix);
      } else {
        reject(outcome.error);
      }
    };

    const timeoutId = setTimeout(() => {
      Logger.warn('[getCurrentPositionOnce] Timed out waiting for a fix', { timeoutMs });
      settle({
        error: { code: TIMEOUT_ERROR_CODE, message: 'Timed out waiting for a location fix' },
      });
    }, timeoutMs);

    Geolocation.getCurrentPosition(
      position => {
        settle({
          fix: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      error => {
        // A late second delivery lands here too and is inert — `settled` makes
        // sure it cannot re-reject a promise that already resolved.
        settle({ error: { code: error.code, message: error.message } });
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        // Ignored by the Play Services path; honoured on iOS.
        timeout: timeoutMs,
        maximumAge: options.maximumAgeMs ?? DEFAULT_MAXIMUM_AGE_MS,
        interval: options.intervalMs ?? DEFAULT_INTERVAL_MS,
      },
    );
  });
}

/**
 * Resolve one position fix, joining any request already in flight.
 *
 * @throws {PositionFixError} `{ code, message }` — never a native `Error`, so
 * callers can branch on `code` without instanceof checks.
 */
export async function getCurrentPositionOnce(
  options: PositionRequestOptions = {},
): Promise<PositionFix> {
  const existing = inFlight;
  if (existing !== null) {
    Logger.debug('[getCurrentPositionOnce] Joining the request already in flight');
    return await existing;
  }

  // Assign before the first await so a synchronous second caller in the same
  // tick sees it. `finally` clears the slot on success AND on failure —
  // leaking it would dead-end every future location request in the app.
  const started = requestFromNative(options).finally(() => {
    inFlight = null;
  });
  inFlight = started;

  return await started;
}

/** Test-only: drops the in-flight reference so suites cannot leak into each other. */
export function resetInFlightPositionRequestForTests(): void {
  inFlight = null;
}
