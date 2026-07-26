/**
 * Map camera + readiness state for the search screen.
 *
 * Owns the MapView ref and every camera move, so callers say *where* to go and
 * never recompute the zoom span themselves — that duplication is what let two
 * call sites drift out of the clamped range (see utils/mapRegion).
 */

import { useCallback, useRef, useState } from 'react';

import { regionFor } from '../utils/mapRegion';

import type MapView from 'react-native-maps';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AnimateOptions {
  /** Override the radius — used while changing radius, before state settles. */
  radiusKm?: number;
  /** Span multiplier; < 1 zooms in. */
  zoom?: number;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 500;

export interface SearchMapCamera {
  mapRef: React.RefObject<MapView | null>;
  /** True once MapView reports ready — markers are withheld until then. */
  isReady: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  /** Move the camera. Zoom is derived centrally; callers pass only a target. */
  animateTo: (coordinates: Coordinates, options?: AnimateOptions) => void;
  handleMapReady: () => void;
}

/**
 * Takes only the radius, deliberately — not the current centre.
 *
 * The centre derives from the selected place, and place selection needs
 * `animateTo` in order to move the camera when a place is chosen. Depending on
 * the centre here would close that loop. Nothing in this hook needs it: every
 * move is towards an explicit target, and recentring is just a move towards the
 * current centre, which the caller already holds.
 */
export function useSearchMapCamera(radiusKm: number): SearchMapCamera {
  const mapRef = useRef<MapView>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const animateTo = useCallback(
    (coordinates: Coordinates, options: AnimateOptions = {}) => {
      const { radiusKm: overrideRadius, zoom = 1, durationMs = DEFAULT_DURATION_MS } = options;
      mapRef.current?.animateToRegion(
        regionFor(coordinates, overrideRadius ?? radiusKm, zoom),
        durationMs,
      );
    },
    [radiusKm],
  );

  const handleMapReady = useCallback(() => {
    setIsReady(true);
    setError(null);
  }, []);

  return { mapRef, isReady, error, setError, animateTo, handleMapReady };
}
