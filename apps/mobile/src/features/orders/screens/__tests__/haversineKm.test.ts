/**
 * haversineKm — great-circle distance between two points.
 *
 * Controls delivery availability: wrong distance = delivery offered outside
 * the MAX_DELIVERY_KM zone, or denied inside it. The backend has its own
 * implementation — these values must agree.
 */

import { haversineKm } from '@/utils/geo';

const TUNIS_CENTER = { lat: 36.8065, lng: 10.1815 };
const LA_MARSA = { lat: 36.8783, lng: 10.325 };
const CARTHAGE = { lat: 36.8528, lng: 10.3306 };

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(TUNIS_CENTER, TUNIS_CENTER)).toBe(0);
  });

  it('is symmetric — a→b equals b→a', () => {
    const ab = haversineKm(TUNIS_CENTER, LA_MARSA);
    const ba = haversineKm(LA_MARSA, TUNIS_CENTER);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('computes Tunis center → La Marsa as ~15 km', () => {
    const km = haversineKm(TUNIS_CENTER, LA_MARSA);
    expect(km).toBeGreaterThan(13);
    expect(km).toBeLessThan(17);
  });

  it('computes La Marsa → Carthage as ~1 km', () => {
    const km = haversineKm(LA_MARSA, CARTHAGE);
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(3);
  });

  it('correctly identifies a delivery within MAX_DELIVERY_KM = 5', () => {
    const nearby = { lat: 36.81, lng: 10.19 };
    const km = haversineKm(TUNIS_CENTER, nearby);
    expect(km).toBeLessThan(5);
  });

  it('correctly identifies a delivery outside MAX_DELIVERY_KM = 5', () => {
    const km = haversineKm(TUNIS_CENTER, LA_MARSA);
    expect(km).toBeGreaterThan(5);
  });

  it('handles the equator (lat=0)', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 1 };
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('handles negative coordinates (southern/western hemisphere)', () => {
    const a = { lat: -33.8688, lng: 151.2093 }; // Sydney
    const b = { lat: -37.8136, lng: 144.9631 }; // Melbourne
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(700);
    expect(km).toBeLessThan(900);
  });

  it('handles antipodal points (max distance ~20,000 km)', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 180 };
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(20_000);
    expect(km).toBeLessThan(20_100);
  });
});
