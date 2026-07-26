/**
 * Map camera geometry for the search screen.
 *
 * The zoom span was derived in four different places with three different
 * results. Two of them — selecting a Google place and selecting an app
 * establishment from the dropdown — skipped the clamp that every other camera
 * move applied, so those two jumps could zoom past the limits nothing else
 * could reach. One implementation now.
 */

import type { Region } from 'react-native-maps';

interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Rough km per degree of latitude — good enough for a map camera. */
const KM_PER_DEGREE = 111;

/** Show noticeably more than the search circle so its edges stay on screen. */
const SPAN_FACTOR = 2.5;

/** Longitude degrees cover less ground than latitude at these latitudes. */
const LONGITUDE_RATIO = 1.2;

/** Below this the camera is uselessly tight; above it, uselessly wide. */
const MIN_DELTA = 0.02;
const MAX_DELTA = 1;

const clamp = (delta: number): number => Math.max(MIN_DELTA, Math.min(delta, MAX_DELTA));

/**
 * The region that frames `radiusKm` around `center`.
 *
 * @param zoom multiplier on the span — < 1 zooms in. Marker taps use 0.5 to
 *   pull in closer than the search circle.
 */
export const regionFor = (center: Coordinates, radiusKm: number, zoom = 1): Region => {
  const latDelta = (radiusKm / KM_PER_DEGREE) * SPAN_FACTOR;
  const lngDelta = latDelta * LONGITUDE_RATIO;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: clamp(latDelta) * zoom,
    longitudeDelta: clamp(lngDelta) * zoom,
  };
};
