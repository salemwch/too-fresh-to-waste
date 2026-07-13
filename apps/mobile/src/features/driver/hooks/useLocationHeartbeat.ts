/**
 * Driver Location Heartbeat
 *
 * Pushes the driver's position to the backend on a timer while they are online.
 * The backend uses the last reported position to decide which drivers get a push
 * when a new delivery order appears nearby.
 */

import { useEffect, useRef } from 'react';

import Geolocation from '@react-native-community/geolocation';

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

    const report = (): void => {
      Geolocation.getCurrentPosition(
        position => {
          void driverService
            .updateLocation(position.coords.latitude, position.coords.longitude)
            .catch((error: Error) => {
              Logger.debug('[useLocationHeartbeat] Heartbeat failed, will retry', {
                message: error.message,
              });
            });
        },
        error => {
          Logger.debug('[useLocationHeartbeat] GPS unavailable', { message: error.message });
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
      );
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
