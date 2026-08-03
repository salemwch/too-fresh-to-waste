/**
 * Order pricing — the single place money is decided.
 *
 * ## The model
 *
 * ```
 *   Customer pays  =  food (subtotal)  +  deliveryFee
 *
 *   Food split        merchant  81%
 *                     platform  19%
 *
 *   Delivery split    driver    3.00 TND
 *                     platform  1.00 TND
 * ```
 *
 * - **Pickup** — food only. No delivery fee, ever.
 * - **Delivery** — food + 4.00 TND, regardless of how the customer pays.
 * - **Payment method is a payment method.** Cash is not a fee and never adds
 *   one.
 *
 * ## What this replaced, and why it mattered
 *
 * There used to be a `serviceFee`, hardcoded at 4 TND and charged when
 * `paymentMethod === 'pay_on_delivery'` — in *both* modes. So the fee tracked
 * how you paid rather than whether anything was delivered, which produced two
 * wrong outcomes at once:
 *
 * 1. **A pickup order paid in cash was charged 4 TND** for collecting your own
 *    food from a counter.
 * 2. **A delivery order paid online was charged nothing for delivery.** The
 *    separate `deliveryFee` field was written onto the order and read by
 *    nothing — `total` was computed before it existed and never included it.
 *    Meanwhile `driverEarnings` (3 TND) *is* real and gets paid out. The
 *    platform funded every online-paid delivery out of its own margin while
 *    booking a 1 TND commission it had never collected, so the revenue report
 *    carried the opposite sign to reality.
 *
 * The two constants happening to both be 4 TND is what kept this hidden: for
 * cash delivery the numbers coincided.
 *
 * ## Why the food/delivery split is separate
 *
 * The merchant sells food; they have no part in delivery. Splitting `total`
 * would hand them 81% of the delivery fee and leave the platform paying a 3 TND
 * driver out of a 0.76 TND share. Every settlement therefore splits
 * {@link OrderPricing.subtotal}, never `total` — see `foodRevenueSplit`.
 */

/** Merchant's share of the food line. */
export const MERCHANT_FOOD_SHARE = 0.81;

/** Platform's share of the food line. */
export const PLATFORM_FOOD_SHARE = 0.19;

/** Share of the platform's food commission donated to charity. */
export const DONATION_RATE_OF_COMMISSION = 0.05;

/** Fallbacks when the env vars are absent. Mirrored in env.validation.ts. */
export const DEFAULT_FLAT_DELIVERY_FEE = 4.0;
export const DEFAULT_DRIVER_DELIVERY_EARNINGS = 3.0;

/** TND is quoted to three decimals (millimes). */
const round = (value: number): number => parseFloat(value.toFixed(3));

export interface OrderPricingInput {
  /** Food total after item discounts — what the customer pays for food. */
  subtotal: number;
  /** Sum of per-item discounts, for display only. */
  discountAmount: number;
  /** True when `deliveryMode === 'delivery'`. */
  isDelivery: boolean;
  /** `FLAT_DELIVERY_FEE`, in TND. */
  flatDeliveryFee: number;
  /** `DRIVER_DELIVERY_EARNINGS`, in TND. */
  driverDeliveryEarnings: number;
}

export interface OrderPricing {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  /** 0 for pickup. Included in {@link total}. */
  deliveryFee: number;
  /** What the customer is charged. */
  total: number;
}

export interface DeliveryEconomics {
  deliveryFee: number;
  driverEarnings: number;
  /** `deliveryFee − driverEarnings`. Platform's cut of delivery. */
  platformDeliveryCommission: number;
}

export interface FoodRevenueSplit {
  merchantAmount: number;
  platformFee: number;
  donation: number;
  netCommission: number;
}

/**
 * Builds the customer-facing invoice.
 *
 * Payment method is deliberately not a parameter: it cannot change any number
 * here. That is the invariant the old `serviceFee` broke.
 */
export function calculateOrderPricing(input: OrderPricingInput): OrderPricing {
  const deliveryFee = input.isDelivery ? round(input.flatDeliveryFee) : 0;
  const taxAmount = 0;

  return {
    subtotal: round(input.subtotal),
    discountAmount: round(input.discountAmount),
    taxAmount,
    deliveryFee,
    total: round(input.subtotal + deliveryFee + taxAmount),
  };
}

/**
 * Splits the delivery fee between driver and platform.
 *
 * Returns `null` for pickup so a caller cannot accidentally record delivery
 * economics on an order that was never delivered.
 */
export function calculateDeliveryEconomics(input: {
  isDelivery: boolean;
  flatDeliveryFee: number;
  driverDeliveryEarnings: number;
}): DeliveryEconomics | null {
  if (!input.isDelivery) {
    return null;
  }

  const deliveryFee = round(input.flatDeliveryFee);
  const driverEarnings = round(input.driverDeliveryEarnings);

  return {
    deliveryFee,
    driverEarnings,
    platformDeliveryCommission: round(deliveryFee - driverEarnings),
  };
}

/**
 * Splits the **food** line between merchant and platform.
 *
 * Takes `subtotal`, never `total`. Passing `total` would give the merchant 81%
 * of the delivery fee — the precise mistake that makes delivery lose money.
 */
export function calculateFoodRevenueSplit(subtotal: number): FoodRevenueSplit {
  const merchantAmount = round(subtotal * MERCHANT_FOOD_SHARE);
  const platformFee = round(subtotal * PLATFORM_FOOD_SHARE);
  const donation = round(platformFee * DONATION_RATE_OF_COMMISSION);

  return {
    merchantAmount,
    platformFee,
    donation,
    netCommission: round(platformFee - donation),
  };
}
