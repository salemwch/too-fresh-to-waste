/**
 * Driver Location Heartbeat
 *
 * Pushes the driver's position to the backend on a timer while they are online.
 * The backend uses the last reported position to decide which drivers get a push
 * when a new delivery order appears nearby.
 */

import { useEffect, useRef } from 'react';

import { getCurrentPositionOnce } from '@/services/location/getCurrentPositionOnce';
import { Logger } from '@/utils/logger';

import { driverService } from '../services/driver.service';

/** Matches the 30s pool refresh — often enough to keep dispatch accurate. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Reports location every 30s while `enabled` is true.
 *
 * A dropped heartbeat is not surfaced to the driver: the next tick retries, and
 * an error toast for a background timer would be pure noise. The interval is
 * cleared on unmount and whenever the driver goes offline, so an offline driver
 * never leaks their position.
 */
export function useLocationHeartbeat(enabled: boolean): void {
  // Held in a ref so the effect can clear the timer it created without
  // re-subscribing every render.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Routed through getCurrentPositionOnce, which serializes single-shot
    // requests process-wide. This one matters most: it fires every 30s, so it
    // is the call most likely to overlap another screen's request — and two
    // overlapping single-shot requests kill the process outright (Play Services
    // `NullPointerException: Listener must not be null`). If a request is
    // already in flight, this tick joins it instead of starting a second one,
    // which is exactly the right behaviour for a heartbeat.
    const report = (): void => {
      void getCurrentPositionOnce({
        enableHighAccuracy: true,
        timeoutMs: 15_000,
        maximumAgeMs: 10_000,
      })
        .then(async fix => {
          await driverService.updateLocation(fix.latitude, fix.longitude);
        })
        .catch((error: unknown) => {
          // A dropped heartbeat is never surfaced to the driver — the next tick
          // retries. Covers both "no fix" and "backend rejected the update".
          const message = error instanceof Error ? error.message : String(error);
          Logger.debug('[useLocationHeartbeat] Heartbeat failed, will retry', { message });
        });
    };

    // Report immediately so going online dispatches without a 30s dead zone.
    report();
    intervalRef.current = setInterval(report, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);
}
