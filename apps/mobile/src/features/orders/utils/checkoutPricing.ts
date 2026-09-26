/**
 * The receipt the checkout screen quotes, before the order exists.
 *
 * Mirrors what the backend stores on the order once it is created
 * (`order.service.ts` item loop + `calculateOrderPricing`):
 *
 *   discountAmount = (originalPrice - discountedPrice) * quantity
 *   subtotal       = discountedPrice * quantity
 *   total          = subtotal + deliveryFee
 *
 * each rounded to 3 decimals (TND is divided into millimes), so the lines shown
 * here are the lines `OrderPricingCard` shows after purchase.
 *
 * The discount lines are omitted rather than shown as zero or negative when
 * the offer carries no real reduction - an original price that is missing, or
 * not above the discounted one. `OrderPricingCard` applies the same rule.
 */

const round = (value: number): number => parseFloat(value.toFixed(3));

/** A missing or unparseable amount counts as 0 rather than rendering "NaN". */
const amount = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export interface CheckoutPricingInput {
  /** Per-unit price before the discount. Missing on malformed offers. */
  originalUnitPrice: number | undefined;
  /** Per-unit price the customer pays. */
  discountedUnitPrice: number | undefined;
  quantity: number;
  /** Already resolved for the selected fulfilment: 0 for pickup. */
  deliveryFee: number;
}

export interface CheckoutPricing {
  /** `originalUnitPrice * quantity`. Only meaningful when `hasDiscount`. */
  originalTotal: number;
  /** Positive amount taken off. 0 when there is no discount. */
  discount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  hasDiscount: boolean;
}

export function computeCheckoutPricing(input: CheckoutPricingInput): CheckoutPricing {
  const quantity = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 0;
  const subtotal = round(amount(input.discountedUnitPrice) * quantity);
  const originalTotal = round(amount(input.originalUnitPrice) * quantity);
  const rawDiscount = round(originalTotal - subtotal);
  const hasDiscount = rawDiscount > 0;
  const deliveryFee = round(amount(input.deliveryFee));

  return {
    originalTotal,
    discount: hasDiscount ? rawDiscount : 0,
    subtotal,
    deliveryFee,
    total: round(subtotal + deliveryFee),
    hasDiscount,
  };
}
