/**
 * The fee the checkout screen QUOTES must equal the fee the backend CHARGES.
 *
 * This is the regression that motivated moving the calculation into
 * `@foodwaste/shared`. Before that, this screen carried:
 *
 *     const DELIVERY_FEE_TND = 4;   // mirrors FLAT_DELIVERY_FEE in the backend
 *
 * with a comment instructing the next person to "change both together". When
 * the backend moved to distance bands, nobody did - so the app quoted a flat
 * 4 TND while the API charged anywhere from 2 to 24. A customer would have been
 * shown one total and charged another, and nothing in either codebase would
 * have failed.
 *
 * There is now exactly one implementation, so the two cannot disagree. These
 * tests assert the property that makes that worth relying on, and pin the
 * published bands so a change to them is a deliberate act rather than a
 * side-effect.
 */

import { calculateDeliveryFee, splitDeliveryFee } from '@foodwaste/shared';

/** What the checkout screen computes, in the same shape it computes it. */
const quotedFee = (isDelivery: boolean, distanceKm: number | null): number =>
  isDelivery ? calculateDeliveryFee(distanceKm ?? 0) : 0;

describe('the fee quoted at checkout', () => {
  it('is zero for pickup at any distance', () => {
    // Pickup must never carry a delivery fee - the original bug in this file
    // charged 4 TND for collecting your own food from a counter.
    for (const km of [0, 1, 5, 13.5, 40, 200]) {
      expect(quotedFee(false, km)).toBe(0);
    }
  });

  it('follows the published bands for delivery', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [1, 2],
      [2.5, 2],
      [3, 2],
      [5.5, 5],
      [8.5, 8],
      [10.5, 10],
      [13.5, 13],
      [15, 14],
    ];
    for (const [km, fee] of table) {
      expect(quotedFee(true, km)).toBe(fee);
    }
  });

  it('quotes the cheapest band before a delivery pin is dropped', () => {
    // `distanceKm` is null until the customer places the pin. The screen must
    // show a real number rather than NaN or nothing - and it must not show
    // free, which would be a quote the backend will not honour.
    const fee = quotedFee(true, null);
    expect(fee).toBe(2);
    expect(Number.isFinite(fee)).toBe(true);
  });

  it('never quotes zero for a delivery order', () => {
    // A zero quote is worse than a wrong one: the customer is shown a free
    // delivery and then charged for it.
    for (let km = 0; km <= 50; km += 0.5) {
      expect(quotedFee(true, km)).toBeGreaterThan(0);
    }
  });

  it('never quotes less for a longer trip', () => {
    let previous = 0;
    for (let km = 0.1; km <= 50; km += 0.1) {
      const fee = quotedFee(true, km);
      expect(fee).toBeGreaterThanOrEqual(previous);
      previous = fee;
    }
  });

  it('is unbounded, because there is no distance limit any more', () => {
    // The 5 km gate is gone from both the backend and this screen. A customer
    // 40 km out gets a price, not a rejection.
    expect(quotedFee(true, 40)).toBeGreaterThan(quotedFee(true, 13.5));
    expect(quotedFee(true, 120)).toBeGreaterThan(quotedFee(true, 40));
  });
});

describe('what the quote implies for the driver', () => {
  it('pays the driver a share, never a flat minimum', () => {
    // The old model paid a flat 3 TND, which the 2 TND band cannot cover.
    const { driverEarnings } = splitDeliveryFee(quotedFee(true, 1));
    expect(driverEarnings).toBe(1.34);
    expect(driverEarnings).toBeLessThan(3);
  });

  it('never leaves the platform funding a delivery', () => {
    for (let km = 0.1; km <= 50; km += 0.5) {
      const { platformCommission } = splitDeliveryFee(quotedFee(true, km));
      expect(platformCommission).toBeGreaterThanOrEqual(0);
    }
  });

  it('splits exactly what the customer was quoted', () => {
    for (const km of [1, 3, 6, 9, 12, 20, 45]) {
      const fee = quotedFee(true, km);
      const { driverEarnings, platformCommission } = splitDeliveryFee(fee);
      expect(driverEarnings + platformCommission).toBeCloseTo(fee, 10);
    }
  });
});
