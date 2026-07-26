/**
 * Map camera + readiness state for the search screen.
 *
 * Owns the MapView ref and every camera move, so callers say *where* to go and
 * never recompute the zoom span themselves — that duplication is what let two
 * call sites drift out of the clamped range (see utils/mapRegion).
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { regionFor } from '../utils/mapRegion';

import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

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
  /** The region framing the current centre and radius. */
  region: Region;
  /** True once MapView reports ready — markers are withheld until then. */
  isReady: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  /** Move the camera. Zoom is derived centrally; callers pass only a target. */
  animateTo: (coordinates: Coordinates, options?: AnimateOptions) => void;
  /** Return to the current centre. */
  recenter: () => void;
  handleMapReady: () => void;
}

export function useSearchMapCamera(center: Coordinates, radiusKm: number): SearchMapCamera {
  const mapRef = useRef<MapView>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const region = useMemo(() => regionFor(center, radiusKm), [center, radiusKm]);

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

  const recenter = useCallback(() => {
    mapRef.current?.animateToRegion(region, 300);
  }, [region]);

  const handleMapReady = useCallback(() => {
    setIsReady(true);
    setError(null);
  }, []);

  return { mapRef, region, isReady, error, setError, animateTo, recenter, handleMapReady };
}
