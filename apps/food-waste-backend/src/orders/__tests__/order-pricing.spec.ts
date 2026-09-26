/**
 * Order pricing model.
 *
 *   Customer pays  =  food (subtotal)  +  deliveryFee
 *
 *   Food:      merchant 81%  /  platform 19%
 *   Delivery:  driver 3 TND  /  platform 1 TND
 *
 * Pickup is food only. Payment method is a payment method — it never changes a
 * price.
 *
 * ## The bugs this pins down
 *
 * The old `serviceFee` was 4 TND whenever `paymentMethod === 'pay_on_delivery'`,
 * in **both** modes, and the separate `deliveryFee` was never added to `total`:
 *
 *  1. A **pickup** order paid in cash was charged 4 TND for collecting food
 *     from a counter.
 *  2. A **delivery** order paid online was charged nothing for delivery, while
 *     `driverEarnings` (3 TND) was real and got paid out — so the platform
 *     funded every online delivery from its own margin and booked a 1 TND
 *     commission it had never collected.
 *
 * Both constants being 4 TND is what hid this: for cash delivery the numbers
 * coincided. Hence the `describe.each` over all four shapes — the seam only
 * shows when payment method and delivery mode vary independently.
 */

import {
  DEFAULT_DRIVER_SHARE,
  MERCHANT_FOOD_SHARE,
  PLATFORM_FOOD_SHARE,
  calculateDeliveryEconomics,
  calculateFoodRevenueSplit,
  calculateOrderPricing,
} from '../utils/order-pricing.util';

const FOOD = 20;

/**
 * 5 km sits inside the 5.5 km band, so it costs 5 TND. Chosen over a boundary
 * value on purpose: the edges are exercised exhaustively in
 * utils/__tests__/delivery-fee.spec.ts, and using one here would couple these
 * assertions to band geometry they are not about.
 */
const TEST_DISTANCE_KM = 5;
const TEST_FEE = 5;

const economics = () =>
  calculateDeliveryEconomics({
    isDelivery: true,
    deliveryDistanceKm: TEST_DISTANCE_KM,
    driverShare: DEFAULT_DRIVER_SHARE,
  });

const price = (isDelivery: boolean) =>
  calculateOrderPricing({
    subtotal: FOOD,
    discountAmount: 0,
    isDelivery,
    deliveryDistanceKm: TEST_DISTANCE_KM,
    driverShare: DEFAULT_DRIVER_SHARE,
  });

describe('calculateOrderPricing — the four order shapes', () => {
  /**
   * The table that would have caught the original bug. Payment method appears
   * only to prove it is irrelevant: it is not an input to the pricing function
   * at all, so it cannot influence a single number below.
   */
  describe.each([
    ['pickup', 'online', false, 0, FOOD],
    ['pickup', 'cash', false, 0, FOOD],
    ['delivery', 'online', true, TEST_FEE, FOOD + TEST_FEE],
    ['delivery', 'cash', true, TEST_FEE, FOOD + TEST_FEE],
  ] as const)('%s + %s', (_mode, _payment, isDelivery, expectedFee, expectedTotal) => {
    it(`charges a delivery fee of ${expectedFee} TND`, () => {
      expect(price(isDelivery).deliveryFee).toBe(expectedFee);
    });

    it(`totals ${expectedTotal} TND`, () => {
      expect(price(isDelivery).total).toBe(expectedTotal);
    });
  });

  it('never charges a delivery fee on pickup', () => {
    // Bug #1. A cash pickup used to cost 4 TND more than a card pickup.
    // Still true under distance pricing: pickup has no distance and no fee.
    expect(price(false).deliveryFee).toBe(0);
    expect(price(false).total).toBe(FOOD);
  });

  it('always charges the delivery fee on delivery', () => {
    // Bug #2. The fee used to be collected only when paying cash.
    expect(price(true).deliveryFee).toBe(TEST_FEE);
    expect(price(true).total).toBe(FOOD + TEST_FEE);
  });

  it('keeps total equal to subtotal + deliveryFee + tax', () => {
    // The invariant that was broken: `total` was computed before the delivery
    // fee existed, so the fee was stored but never charged.
    for (const isDelivery of [true, false]) {
      const p = price(isDelivery);
      expect(p.total).toBe(p.subtotal + p.deliveryFee + p.taxAmount);
    }
  });

  it('prices a longer delivery higher than a shorter one', () => {
    // Replaces "honours a configured fee": there is no configured flat fee any
    // more. The fee is a function of distance, so this is the property that
    // replaced it.
    const near = calculateOrderPricing({
      subtotal: 10,
      discountAmount: 0,
      isDelivery: true,
      deliveryDistanceKm: 2,
      driverShare: DEFAULT_DRIVER_SHARE,
    });
    const far = calculateOrderPricing({
      subtotal: 10,
      discountAmount: 0,
      isDelivery: true,
      deliveryDistanceKm: 12,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(near.deliveryFee).toBe(2);
    expect(far.deliveryFee).toBe(13);
    expect(far.total).toBeGreaterThan(near.total);
  });

  it('charges no fee beyond any distance limit, because there is none', () => {
    // The 5 km gate used to throw a BadRequestException here.
    const p = calculateOrderPricing({
      subtotal: 10,
      discountAmount: 0,
      isDelivery: true,
      deliveryDistanceKm: 40,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(p.deliveryFee).toBeGreaterThan(13);
    expect(p.total).toBe(10 + p.deliveryFee);
  });

  it('passes the discount through for display without double-counting it', () => {
    // subtotal is already net of discounts; deducting again would undercharge.
    const p = calculateOrderPricing({
      subtotal: 18,
      discountAmount: 2,
      isDelivery: false,
      deliveryDistanceKm: TEST_DISTANCE_KM,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(p.discountAmount).toBe(2);
    expect(p.total).toBe(18);
  });

  it('rounds to millimes (3dp)', () => {
    const p = calculateOrderPricing({
      subtotal: 10.1234,
      discountAmount: 0,
      isDelivery: true,
      deliveryDistanceKm: TEST_DISTANCE_KM,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(p.subtotal).toBe(10.123);
    expect(p.total.toString()).toMatch(/^\d+(\.\d{1,3})?$/);
  });

  it('handles a zero-cost order without inventing a total', () => {
    const p = calculateOrderPricing({
      subtotal: 0,
      discountAmount: 0,
      isDelivery: false,
      deliveryDistanceKm: TEST_DISTANCE_KM,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(p.total).toBe(0);
  });
});

describe('calculateDeliveryEconomics', () => {
  it('pays the driver 80% and keeps 20% for the platform', () => {
    // Was a flat 3 TND driver / 1 TND platform on a flat 4 TND fee, then 67/33
    // of a distance-based fee. 80/20 since 2026-09-24 (product owner). A share
    // scales with the trip and cannot exceed what was collected.
    expect(economics()).toEqual({
      deliveryFee: 5,
      driverEarnings: 4,
      platformDeliveryCommission: 1,
    });
  });

  it('splits the fee exactly — nothing is created or lost', () => {
    const e = economics();
    expect(e?.driverEarnings ?? 0).toBeCloseTo(
      (e?.deliveryFee ?? 0) - (e?.platformDeliveryCommission ?? 0),
      3,
    );
  });

  it('returns null for pickup so delivery economics cannot be recorded', () => {
    // Guards against an order that was never delivered accruing driver
    // earnings — those are summed into real payouts.
    expect(
      calculateDeliveryEconomics({
        isDelivery: false,
        deliveryDistanceKm: TEST_DISTANCE_KM,
        driverShare: DEFAULT_DRIVER_SHARE,
      }),
    ).toBeNull();
  });

  it('matches the fee the customer was quoted', () => {
    // The settlement record and the invoice must agree, or the platform pays a
    // driver against a fee it never charged.
    expect(economics()?.deliveryFee).toBe(price(true).deliveryFee);
  });

  it('can never yield a negative platform cut', () => {
    // This test used to assert the OPPOSITE: with a flat driver amount the
    // platform could be left out of pocket, and the arithmetic was deliberately
    // left honest rather than clamped. A share makes that unreachable at any
    // distance, which is the whole reason for moving off a flat amount - the
    // 2 TND short band could not have covered a 3 TND driver cut.
    for (const km of [0.5, 2.5, 5.5, 13.5, 40]) {
      const e = calculateDeliveryEconomics({
        isDelivery: true,
        deliveryDistanceKm: km,
        driverShare: DEFAULT_DRIVER_SHARE,
      });

      expect(e?.platformDeliveryCommission).toBeGreaterThanOrEqual(0);
    }
  });

  it('pays the driver the configured share and the platform the rest', () => {
    const e = calculateDeliveryEconomics({
      isDelivery: true,
      deliveryDistanceKm: TEST_DISTANCE_KM,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    // 5 TND fee at 80 / 20.
    expect(e?.deliveryFee).toBe(TEST_FEE);
    expect(e?.driverEarnings).toBe(4);
    expect(e?.platformDeliveryCommission).toBe(1);
  });

  it('never pays a flat minimum on a short trip', () => {
    // The instruction that drove this change: no 3 TND floor, because a floor
    // is what made the 2 TND band impossible.
    const e = calculateDeliveryEconomics({
      isDelivery: true,
      deliveryDistanceKm: 1,
      driverShare: DEFAULT_DRIVER_SHARE,
    });

    expect(e?.deliveryFee).toBe(2);
    expect(e?.driverEarnings).toBe(1.6);
    expect(e?.driverEarnings).toBeLessThan(3);
  });
});

describe('calculateFoodRevenueSplit', () => {
  it('splits food 81 / 19', () => {
    const split = calculateFoodRevenueSplit(100);

    expect(split.merchantAmount).toBe(81);
    expect(split.platformFee).toBe(19);
  });

  it('splits the FOOD line, never the total', () => {
    // The critical property. Splitting `total` (which now includes the delivery
    // fee) would hand the merchant 81% of a fee they had no part in earning,
    // leaving the platform to pay a 3 TND driver out of a 0.76 TND share.
    const p = price(true); // 20 food + 5 delivery = 25
    const split = calculateFoodRevenueSplit(p.subtotal);

    expect(split.merchantAmount).toBe(16.2); // 81% of 20, not of 25
    expect(split.merchantAmount).not.toBeCloseTo(p.total * MERCHANT_FOOD_SHARE, 2);
  });

  it('leaves the whole delivery fee outside the merchant split', () => {
    const p = price(true);
    const split = calculateFoodRevenueSplit(p.subtotal);
    const platformTotal = split.platformFee + (economics()?.platformDeliveryCommission ?? 0);

    // 20 food + 5 delivery = 25 collected.
    // merchant 16.20 + platform (3.80 food + 1.65 delivery) + driver 3.35 = 25
    const driverEarnings = economics()?.driverEarnings ?? 0;
    expect(split.merchantAmount + platformTotal + driverEarnings).toBeCloseTo(p.total, 3);
  });

  it('donates 5% of the platform food commission', () => {
    const split = calculateFoodRevenueSplit(100);

    expect(split.donation).toBe(0.95); // 19 * 0.05
    expect(split.netCommission).toBe(18.05);
  });

  it('bases the donation on food only, not on delivery margin', () => {
    // Delivery margin funds the driver network, not the giving programme.
    const split = calculateFoodRevenueSplit(price(true).subtotal);

    expect(split.donation).toBe(calculateFoodRevenueSplit(FOOD).donation);
  });

  it('adds up: merchant + platform = food', () => {
    const split = calculateFoodRevenueSplit(37.5);

    expect(split.merchantAmount + split.platformFee).toBeCloseTo(37.5, 2);
  });

  it('keeps the shares complementary', () => {
    expect(MERCHANT_FOOD_SHARE + PLATFORM_FOOD_SHARE).toBeCloseTo(1, 10);
  });

  it('handles a zero food line', () => {
    expect(calculateFoodRevenueSplit(0)).toEqual({
      merchantAmount: 0,
      platformFee: 0,
      donation: 0,
      netCommission: 0,
    });
  });
});
