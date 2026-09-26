/**
 * The receipt quoted at checkout must add up, and must match the lines the
 * order shows after purchase (`OrderPricingCard`, fed by what the backend
 * stores: discountAmount = (original - discounted) * quantity).
 */

import { computeCheckoutPricing, type CheckoutPricingInput } from '../checkoutPricing';

const base: CheckoutPricingInput = {
  originalUnitPrice: 15,
  discountedUnitPrice: 6,
  quantity: 1,
  deliveryFee: 0,
};

describe('computeCheckoutPricing', () => {
  it('shows the original price, the discount and the discounted subtotal for pickup', () => {
    expect(computeCheckoutPricing(base)).toEqual({
      originalTotal: 15,
      discount: 9,
      subtotal: 6,
      deliveryFee: 0,
      total: 6,
      hasDiscount: true,
    });
  });

  it('adds the delivery fee to the total, never to the food lines', () => {
    const pricing = computeCheckoutPricing({ ...base, deliveryFee: 5 });
    expect(pricing.subtotal).toBe(6);
    expect(pricing.discount).toBe(9);
    expect(pricing.deliveryFee).toBe(5);
    expect(pricing.total).toBe(11);
  });

  it('scales the discount with the quantity, as the backend does', () => {
    // Backend: itemDiscount = originalPrice * qty - discountedPrice * qty.
    // A per-unit discount here would quote 9 while the order stores 27.
    const pricing = computeCheckoutPricing({ ...base, quantity: 3 });
    expect(pricing.originalTotal).toBe(45);
    expect(pricing.discount).toBe(27);
    expect(pricing.subtotal).toBe(18);
    expect(pricing.total).toBe(18);
  });

  describe.each([
    ['the original price is missing', { originalUnitPrice: undefined }],
    ['the original price equals the discounted one', { originalUnitPrice: 6 }],
    ['the original price is below the discounted one', { originalUnitPrice: 4 }],
    ['the original price is unparseable', { originalUnitPrice: Number.NaN }],
  ])('when %s', (_label, override: Partial<CheckoutPricingInput>) => {
    const pricing = computeCheckoutPricing({ ...base, ...override });

    it('hides the discount lines instead of printing zero or a negative saving', () => {
      expect(pricing.hasDiscount).toBe(false);
      expect(pricing.discount).toBe(0);
    });

    it('still charges the discounted price', () => {
      expect(pricing.subtotal).toBe(6);
      expect(pricing.total).toBe(6);
    });
  });

  it('never renders NaN when the discounted price is unparseable', () => {
    const pricing = computeCheckoutPricing({ ...base, discountedUnitPrice: Number.NaN });
    expect(pricing.subtotal).toBe(0);
    expect(pricing.total).toBe(0);
    expect(Object.values(pricing).some(v => typeof v === 'number' && Number.isNaN(v))).toBe(false);
  });

  it('never renders NaN when the delivery fee is unparseable', () => {
    const pricing = computeCheckoutPricing({ ...base, deliveryFee: Number.NaN });
    expect(pricing.deliveryFee).toBe(0);
    expect(pricing.total).toBe(6);
  });

  it.each([0, -1, Number.NaN])('quotes nothing for a quantity of %p', quantity => {
    const pricing = computeCheckoutPricing({ ...base, quantity });
    expect(pricing).toEqual({
      originalTotal: 0,
      discount: 0,
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      hasDiscount: false,
    });
  });

  it('rounds to millimes, as the backend does, so float noise never reaches the screen', () => {
    // 0.1 * 3 is 0.30000000000000004 in IEEE 754; 3.3 - 0.3 is 2.9999999999999996.
    const pricing = computeCheckoutPricing({
      originalUnitPrice: 1.1,
      discountedUnitPrice: 0.1,
      quantity: 3,
      deliveryFee: 2,
    });
    expect(pricing.subtotal).toBe(0.3);
    expect(pricing.originalTotal).toBe(3.3);
    expect(pricing.discount).toBe(3);
    expect(pricing.total).toBe(2.3);
  });

  it.each([
    [15, 6, 1, 0],
    [12, 6, 2, 5],
    [9.9, 4.95, 4, 8],
    [20, 7.5, 3, 14],
  ])(
    'adds up for original %p, discounted %p, quantity %p, fee %p',
    (originalUnitPrice, discountedUnitPrice, quantity, deliveryFee) => {
      const p = computeCheckoutPricing({
        originalUnitPrice,
        discountedUnitPrice,
        quantity,
        deliveryFee,
      });
      // The receipt must read top to bottom: original - discount = subtotal,
      // subtotal + fee = total.
      expect(p.originalTotal - p.discount).toBeCloseTo(p.subtotal, 3);
      expect(p.subtotal + p.deliveryFee).toBeCloseTo(p.total, 3);
    },
  );
});
