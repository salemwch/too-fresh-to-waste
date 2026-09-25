/**
 * Delivery fee bands.
 *
 * This decides what a customer is charged, so the cases that matter are the
 * band EDGES and the unbounded tail - the two places an off-by-one is money
 * rather than cosmetics, and neither throws when it is wrong.
 */

import {
  DELIVERY_FEE_AT_LIMIT,
  DELIVERY_FEE_BANDS,
  DELIVERY_FEE_STEP_FEE,
  DELIVERY_FEE_STEP_KM,
  DELIVERY_FEE_TABLE_LIMIT_KM,
  calculateDeliveryFee,
  splitDeliveryFee,
} from '../delivery-fee.util';

describe('the published bands', () => {
  it.each([
    [0.1, 2],
    [1, 2],
    [2.5, 2],
    [3, 2],
    [5, 5],
    [5.5, 5],
    [6, 8],
    [8.5, 8],
    [9, 10],
    [10.5, 10],
    [11, 13],
    [13.5, 13],
  ])('%s km costs %s TND', (km, fee) => {
    expect(calculateDeliveryFee(km)).toBe(fee);
  });

  it('extends the first band to 3 km', () => {
    // The spec skipped from "0-2.5" to "3.5-5.5", leaving 2.5-3.5 unpriced.
    // Resolved by extending the FIRST band to 3 km, so the table is contiguous
    // and a 3 km delivery is the cheap band rather than the 5 TND one.
    expect(calculateDeliveryFee(2.6)).toBe(2);
    expect(calculateDeliveryFee(3)).toBe(2);
    expect(calculateDeliveryFee(3.01)).toBe(5);
  });
});

describe('band edges are upper-inclusive', () => {
  // A customer quoted one price at the edge and charged another is a support
  // ticket, and haversine distances land on these edges regularly.
  it.each(DELIVERY_FEE_BANDS.map(b => [b.upToKm, b.fee] as const))(
    'exactly %s km still costs %s TND',
    (upToKm, fee) => {
      expect(calculateDeliveryFee(upToKm)).toBe(fee);
    },
  );

  it.each([
    [3.01, 5],
    [5.51, 8],
    [8.51, 10],
    [10.51, 13],
  ])('one centimetre past a boundary (%s km) moves up a band', (km, fee) => {
    expect(calculateDeliveryFee(km)).toBe(fee);
  });

  it('keeps floating-point noise inside its band', () => {
    // haversineKm really does return values like this; comparing them raw
    // prices a 5.5 km delivery as 8 TND.
    expect(calculateDeliveryFee(5.500000000000001)).toBe(5);
    expect(calculateDeliveryFee(2.4999999999)).toBe(2);
  });
});

describe('beyond the table: 1 TND per started 1.5 km', () => {
  it.each([
    [13.5, 13],
    [13.6, 14],
    [15.0, 14],
    [15.01, 15],
    [16.5, 15],
    [16.6, 16],
    [20, 18],
    [30, 24], // 16.5 km beyond = exactly 11 steps, no part step
  ])('%s km costs %s TND', (km, fee) => {
    expect(calculateDeliveryFee(km)).toBe(fee);
  });

  it('charges a full step for a part step', () => {
    // "adds 1 TND for each 1.5 km more" - a started step is a whole step, or a
    // 13.6 km trip would be free of the surcharge it exists to cover.
    const justOver = DELIVERY_FEE_TABLE_LIMIT_KM + 0.01;
    expect(calculateDeliveryFee(justOver)).toBe(DELIVERY_FEE_AT_LIMIT + DELIVERY_FEE_STEP_FEE);
  });

  it('never decreases as distance grows', () => {
    // The single property that matters most: a longer trip can never cost less.
    let previous = 0;
    for (let km = 0.1; km <= 60; km += 0.1) {
      const fee = calculateDeliveryFee(km);
      expect(fee).toBeGreaterThanOrEqual(previous);
      previous = fee;
    }
  });

  it('grows without an upper cap', () => {
    // Delivery is open at any distance now; the price is what carries the cost,
    // so there must be no ceiling hiding a loss at the far end.
    expect(calculateDeliveryFee(100)).toBeGreaterThan(calculateDeliveryFee(50));
    expect(calculateDeliveryFee(1000)).toBeGreaterThan(calculateDeliveryFee(100));
  });

  it('adds exactly one step per step-length', () => {
    const a = calculateDeliveryFee(DELIVERY_FEE_TABLE_LIMIT_KM + DELIVERY_FEE_STEP_KM);
    const b = calculateDeliveryFee(DELIVERY_FEE_TABLE_LIMIT_KM + DELIVERY_FEE_STEP_KM * 2);
    expect(b - a).toBe(DELIVERY_FEE_STEP_FEE);
  });
});

describe('a bad distance cannot produce a cheap delivery', () => {
  const cheapest = DELIVERY_FEE_BANDS[0]?.fee ?? 0;

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s distance falls back to the first band', (_label, km) => {
    // A missing coordinate must not become a discount, and must never be free
    // or negative - both would be silent revenue loss.
    expect(calculateDeliveryFee(km as number)).toBe(cheapest);
  });

  it('is never free and never negative at any distance', () => {
    for (const km of [-1, 0, 0.0001, 1, 13.5, 13.51, 500, Number.NaN]) {
      expect(calculateDeliveryFee(km)).toBeGreaterThan(0);
    }
  });
});

describe('the bands themselves stay coherent', () => {
  it('are ordered by distance', () => {
    const ks = DELIVERY_FEE_BANDS.map(b => b.upToKm);
    expect([...ks].sort((a, b) => a - b)).toEqual(ks);
  });

  it('are ordered by fee', () => {
    const fs = DELIVERY_FEE_BANDS.map(b => b.fee);
    expect([...fs].sort((a, b) => a - b)).toEqual(fs);
  });

  it('end where the per-step rule takes over', () => {
    // If these drift apart the tail either double-charges the last band or
    // leaves a gap that silently prices as the band below.
    expect(DELIVERY_FEE_BANDS[DELIVERY_FEE_BANDS.length - 1]?.upToKm).toBe(
      DELIVERY_FEE_TABLE_LIMIT_KM,
    );
    expect(DELIVERY_FEE_BANDS[DELIVERY_FEE_BANDS.length - 1]?.fee).toBe(DELIVERY_FEE_AT_LIMIT);
  });
});

// ============================================================================
// The 67/33 split
// ============================================================================

describe('splitting the fee between driver and platform', () => {
  it('matches the agreed table exactly', () => {
    // These are the numbers the split was signed off on. If any of them move,
    // someone is being paid differently than was agreed.
    // Re-agreed 2026-09-24 at 80 / 20 (product owner); was 67 / 33.
    const expected: ReadonlyArray<readonly [number, number, number]> = [
      [2, 1.6, 0.4],
      [5, 4, 1],
      [8, 6.4, 1.6],
      [10, 8, 2],
      [13, 10.4, 2.6],
    ];
    for (const [fee, driver, platform] of expected) {
      const split = splitDeliveryFee(fee);
      expect(split.driverEarnings).toBe(driver);
      expect(split.platformCommission).toBe(platform);
    }
  });

  it('always sums back to exactly what the customer paid', () => {
    // The reconciliation property. Rounding both sides independently makes this
    // drift by a cent, which surfaces as an unexplained penny in settlement.
    for (let fee = 1; fee <= 60; fee += 1) {
      const { driverEarnings, platformCommission } = splitDeliveryFee(fee);
      expect(driverEarnings + platformCommission).toBeCloseTo(fee, 10);
    }
  });

  it('holds across every real fee the bands can produce', () => {
    for (let km = 0.1; km <= 40; km += 0.1) {
      const fee = calculateDeliveryFee(km);
      const { driverEarnings, platformCommission } = splitDeliveryFee(fee);
      expect(driverEarnings + platformCommission).toBeCloseTo(fee, 10);
      expect(platformCommission).toBeGreaterThanOrEqual(0);
    }
  });

  it('never pays the driver a flat minimum', () => {
    // The explicit instruction: no 3 TND floor. A floor is what made the 2 TND
    // short-distance band impossible in the first place.
    expect(splitDeliveryFee(2).driverEarnings).toBeLessThan(3);
  });

  it('never leaves the platform out of pocket', () => {
    // The failure the flat driver amount caused. A share cannot produce it at
    // any fee, and this is the assertion that keeps it that way.
    for (let fee = 0; fee <= 100; fee += 0.5) {
      expect(splitDeliveryFee(fee).platformCommission).toBeGreaterThanOrEqual(0);
    }
  });

  it('pays the driver more for a longer trip', () => {
    expect(splitDeliveryFee(calculateDeliveryFee(12)).driverEarnings).toBeGreaterThan(
      splitDeliveryFee(calculateDeliveryFee(2)).driverEarnings,
    );
  });
});

describe('the share is configurable', () => {
  it.each([
    [0.5, 5, 2.5, 2.5],
    [0.67, 5, 3.35, 1.65],
    [0.8, 5, 4, 1],
    [1, 5, 5, 0],
    [0, 5, 0, 5],
  ])('a %s share of a %s TND fee pays %s / %s', (share, fee, driver, platform) => {
    const split = splitDeliveryFee(fee, share);
    expect(split.driverEarnings).toBe(driver);
    expect(split.platformCommission).toBe(platform);
  });

  it.each([
    ['above 1', 1.5],
    ['negative', -0.2],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s share falls back to the default rather than paying out nonsense', (_label, share) => {
    // A misconfigured env var must not produce a negative payout or one larger
    // than the fee - both would settle real money incorrectly.
    const split = splitDeliveryFee(10, share as number);
    expect(split.driverEarnings).toBe(splitDeliveryFee(10).driverEarnings);
    expect(split.platformCommission).toBeGreaterThanOrEqual(0);
  });
});

describe('a bad fee cannot pay anyone', () => {
  it.each([
    ['zero', 0],
    ['negative', -8],
    ['NaN', Number.NaN],
  ])('%s fee pays out nothing at all', (_label, fee) => {
    const split = splitDeliveryFee(fee as number);
    expect(split.driverEarnings).toBe(0);
    expect(split.platformCommission).toBe(0);
  });
});
