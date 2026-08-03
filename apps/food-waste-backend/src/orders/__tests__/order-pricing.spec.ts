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
  DEFAULT_DRIVER_DELIVERY_EARNINGS,
  DEFAULT_FLAT_DELIVERY_FEE,
  MERCHANT_FOOD_SHARE,
  PLATFORM_FOOD_SHARE,
  calculateDeliveryEconomics,
  calculateFoodRevenueSplit,
  calculateOrderPricing,
} from '../utils/order-pricing.util';

const FOOD = 20;

const price = (isDelivery: boolean) =>
  calculateOrderPricing({
    subtotal: FOOD,
    discountAmount: 0,
    isDelivery,
    flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
    driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
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
    ['delivery', 'online', true, 4, FOOD + 4],
    ['delivery', 'cash', true, 4, FOOD + 4],
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
    expect(price(false).deliveryFee).toBe(0);
    expect(price(false).total).toBe(FOOD);
  });

  it('always charges the delivery fee on delivery', () => {
    // Bug #2. The fee used to be collected only when paying cash.
    expect(price(true).deliveryFee).toBe(4);
    expect(price(true).total).toBe(FOOD + 4);
  });

  it('keeps total equal to subtotal + deliveryFee + tax', () => {
    // The invariant that was broken: `total` was computed before the delivery
    // fee existed, so the fee was stored but never charged.
    for (const isDelivery of [true, false]) {
      const p = price(isDelivery);
      expect(p.total).toBe(p.subtotal + p.deliveryFee + p.taxAmount);
    }
  });

  it('honours a configured fee other than the default', () => {
    const p = calculateOrderPricing({
      subtotal: 10,
      discountAmount: 0,
      isDelivery: true,
      flatDeliveryFee: 6.5,
      driverDeliveryEarnings: 4,
    });

    expect(p.deliveryFee).toBe(6.5);
    expect(p.total).toBe(16.5);
  });

  it('passes the discount through for display without double-counting it', () => {
    // subtotal is already net of discounts; deducting again would undercharge.
    const p = calculateOrderPricing({
      subtotal: 18,
      discountAmount: 2,
      isDelivery: false,
      flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
      driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
    });

    expect(p.discountAmount).toBe(2);
    expect(p.total).toBe(18);
  });

  it('rounds to millimes (3dp)', () => {
    const p = calculateOrderPricing({
      subtotal: 10.1234,
      discountAmount: 0,
      isDelivery: true,
      flatDeliveryFee: 4.0005,
      driverDeliveryEarnings: 3,
    });

    expect(p.subtotal).toBe(10.123);
    expect(p.total.toString()).toMatch(/^\d+(\.\d{1,3})?$/);
  });

  it('handles a zero-cost order without inventing a total', () => {
    const p = calculateOrderPricing({
      subtotal: 0,
      discountAmount: 0,
      isDelivery: false,
      flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
      driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
    });

    expect(p.total).toBe(0);
  });
});

describe('calculateDeliveryEconomics', () => {
  const economics = () =>
    calculateDeliveryEconomics({
      isDelivery: true,
      flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
      driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
    });

  it('pays the driver 3 TND and keeps 1 TND for the platform', () => {
    expect(economics()).toEqual({
      deliveryFee: 4,
      driverEarnings: 3,
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
        flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
        driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
      }),
    ).toBeNull();
  });

  it('matches the fee the customer was quoted', () => {
    // The settlement record and the invoice must agree, or the platform pays a
    // driver against a fee it never charged.
    expect(economics()?.deliveryFee).toBe(price(true).deliveryFee);
  });

  it('yields a negative platform cut if the driver share exceeds the fee', () => {
    // Not reachable through config — Joi rejects it — but the arithmetic must
    // stay honest rather than clamp and hide a loss.
    const e = calculateDeliveryEconomics({
      isDelivery: true,
      flatDeliveryFee: 3,
      driverDeliveryEarnings: 4,
    });

    expect(e?.platformDeliveryCommission).toBe(-1);
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
    const p = price(true); // 20 food + 4 delivery = 24
    const split = calculateFoodRevenueSplit(p.subtotal);

    expect(split.merchantAmount).toBe(16.2); // 81% of 20, not of 24
    expect(split.merchantAmount).not.toBeCloseTo(p.total * MERCHANT_FOOD_SHARE, 2);
  });

  it('leaves the whole delivery fee outside the merchant split', () => {
    const p = price(true);
    const split = calculateFoodRevenueSplit(p.subtotal);
    const platformTotal =
      split.platformFee +
      (calculateDeliveryEconomics({
        isDelivery: true,
        flatDeliveryFee: DEFAULT_FLAT_DELIVERY_FEE,
        driverDeliveryEarnings: DEFAULT_DRIVER_DELIVERY_EARNINGS,
      })?.platformDeliveryCommission ?? 0);

    // 20 food + 4 delivery = 24 collected.
    // merchant 16.20 + platform (3.80 food + 1.00 delivery) + driver 3.00 = 24
    expect(split.merchantAmount + platformTotal + 3).toBeCloseTo(p.total, 3);
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
