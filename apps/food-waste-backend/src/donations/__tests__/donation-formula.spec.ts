import {
  PLATFORM_FOOD_SHARE,
  DONATION_RATE_OF_COMMISSION,
} from '../../orders/utils/order-pricing.util';
import { DONATION_CONSTANTS } from '../interfaces/donation.interface';

describe('Donation formula consistency', () => {
  it('DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE matches PLATFORM_FOOD_SHARE', () => {
    expect(DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE).toBe(PLATFORM_FOOD_SHARE);
  });

  it('DONATION_CONSTANTS.DONATION_PERCENTAGE matches DONATION_RATE_OF_COMMISSION', () => {
    expect(DONATION_CONSTANTS.DONATION_PERCENTAGE).toBe(DONATION_RATE_OF_COMMISSION);
  });

  it('calculates 0.95% of subtotal (subtotal * 0.19 * 0.05)', () => {
    const subtotal = 100;
    const expected = parseFloat(
      (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
    );
    expect(expected).toBe(0.95);
  });

  it('calculates correctly for a real-world subtotal of 15.5 TND', () => {
    const subtotal = 15.5;
    const expected = parseFloat(
      (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
    );
    expect(expected).toBe(0.147);
  });

  it('matches the formula used in order-pricing.util.ts', () => {
    const subtotal = 42;
    const fromConstants = parseFloat(
      (
        subtotal *
        DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE *
        DONATION_CONSTANTS.DONATION_PERCENTAGE
      ).toFixed(3),
    );
    const fromOrderPricing = parseFloat(
      (subtotal * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
    );
    expect(fromConstants).toBe(fromOrderPricing);
  });
});
