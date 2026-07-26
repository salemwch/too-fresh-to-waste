/**
 * regionFor — the map camera span.
 *
 * These exist because the span was derived in four places with three different
 * results, and two of them skipped the clamp. The clamp tests below are the
 * ones that would have caught it.
 */

import { regionFor } from '../mapRegion';

const CENTER = { latitude: 35.82, longitude: 10.63 };

describe('regionFor', () => {
  it('centres on the given coordinates', () => {
    const region = regionFor(CENTER, 15);

    expect(region.latitude).toBe(CENTER.latitude);
    expect(region.longitude).toBe(CENTER.longitude);
  });

  it('widens the span as the radius grows', () => {
    const small = regionFor(CENTER, 5);
    const large = regionFor(CENTER, 15);

    expect(large.latitudeDelta).toBeGreaterThan(small.latitudeDelta);
  });

  it('keeps longitude wider than latitude', () => {
    const region = regionFor(CENTER, 10);

    expect(region.longitudeDelta).toBeGreaterThan(region.latitudeDelta);
  });

  // The regression. Selecting a place from the dropdown used to bypass this,
  // so a large radius zoomed further out than any other camera move could.
  describe('clamping', () => {
    it('does not exceed the maximum span for a huge radius', () => {
      const region = regionFor(CENTER, 10_000);

      expect(region.latitudeDelta).toBeLessThanOrEqual(1);
      expect(region.longitudeDelta).toBeLessThanOrEqual(1);
    });

    it('does not go below the minimum span for a tiny radius', () => {
      const region = regionFor(CENTER, 0.01);

      expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.02);
      expect(region.longitudeDelta).toBeGreaterThanOrEqual(0.02);
    });

    it('clamps a zero radius rather than collapsing the camera', () => {
      const region = regionFor(CENTER, 0);

      expect(region.latitudeDelta).toBe(0.02);
    });
  });

  describe('zoom multiplier', () => {
    it('is a no-op at 1', () => {
      expect(regionFor(CENTER, 10, 1)).toEqual(regionFor(CENTER, 10));
    });

    // Marker taps pull in to half the span.
    it('halves the span at 0.5', () => {
      const base = regionFor(CENTER, 10);
      const zoomed = regionFor(CENTER, 10, 0.5);

      expect(zoomed.latitudeDelta).toBeCloseTo(base.latitudeDelta * 0.5, 10);
      expect(zoomed.longitudeDelta).toBeCloseTo(base.longitudeDelta * 0.5, 10);
    });

    // Deliberate: zoom applies after clamping, so a marker tap can still get
    // closer than MIN_DELTA. Clamping is about framing the search radius, not
    // about capping an explicit zoom-in.
    it('applies after clamping, so zoom can go below the minimum span', () => {
      const region = regionFor(CENTER, 0.01, 0.5);

      expect(region.latitudeDelta).toBeCloseTo(0.01, 10);
    });
  });
});
