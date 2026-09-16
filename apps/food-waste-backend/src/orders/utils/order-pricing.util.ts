import { DEFAULT_DRIVER_SHARE, calculateDeliveryFee, splitDeliveryFee } from './delivery-fee.util';

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
 *   Delivery fee      distance-based, see delivery-fee.util.ts
 *   Delivery split    driver    67% of the fee (DELIVERY_DRIVER_SHARE)
 *                     platform  the remainder
 * ```
 *
 * - **Pickup** — food only. No delivery fee, ever.
 * - **Delivery** — food + a distance-based fee, regardless of how the customer
 *   pays. Available at any distance; there is no longer a 5 km cutoff.
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

/**
 * Fallback when `DELIVERY_DRIVER_SHARE` is absent. Mirrored in env.validation.ts.
 *
 * Re-exported from delivery-fee.util so callers have one import for the whole
 * delivery money model. The flat `DEFAULT_FLAT_DELIVERY_FEE` and
 * `DEFAULT_DRIVER_DELIVERY_EARNINGS` are gone: the fee now depends on distance,
 * and a flat 3.00 TND driver cut is impossible against a 2.00 TND fee.
 */
export { DEFAULT_DRIVER_SHARE } from './delivery-fee.util';

/** TND is quoted to three decimals (millimes). */
const round = (value: number): number => parseFloat(value.toFixed(3));

export interface OrderPricingInput {
  /** Food total after item discounts — what the customer pays for food. */
  subtotal: number;
  /** Sum of per-item discounts, for display only. */
  discountAmount: number;
  /** True when `deliveryMode === 'delivery'`. */
  isDelivery: boolean;
  /**
   * Straight-line distance from establishment to customer, in km.
   *
   * Ignored for pickup. NOTE this is haversine, not road distance - a real
   * route is typically 20-40% longer, so both the fee and the driver's share
   * understate the actual trip on longer deliveries.
   */
  deliveryDistanceKm: number;
  /** `DELIVERY_DRIVER_SHARE`, 0..1. */
  driverShare: number;
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
  const deliveryFee = input.isDelivery ? round(calculateDeliveryFee(input.deliveryDistanceKm)) : 0;
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
  deliveryDistanceKm: number;
  driverShare?: number;
}): DeliveryEconomics | null {
  if (!input.isDelivery) {
    return null;
  }

  /*
   * Recomputed from the SAME distance the customer was quoted on, via the same
   * function, rather than being passed the fee. Two paths to one number is how
   * the settlement record and the invoice drift apart.
   */
  const deliveryFee = calculateDeliveryFee(input.deliveryDistanceKm);
  const { driverEarnings, platformCommission } = splitDeliveryFee(
    deliveryFee,
    input.driverShare ?? DEFAULT_DRIVER_SHARE,
  );

  return {
    deliveryFee: round(deliveryFee),
    driverEarnings: round(driverEarnings),
    platformDeliveryCommission: round(platformCommission),
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

/**
 * Mongo aggregation expression for a single order's merchant earnings.
 * Mirrors {@link calculateFoodRevenueSplit}'s `merchantAmount` — splits
 * `pricing.subtotal`, never `pricing.total`. Shared by every aggregation
 * that reports what a merchant actually earned, as opposed to what the
 * customer paid.
 *
 * Rounded to 3 decimals (millimes — see {@link round} above) for the same
 * reason `calculateFoodRevenueSplit` rounds in JS: `subtotal * 0.81` is not
 * exactly representable in IEEE-754 (e.g. `20 * 0.81 === 16.200000000000003`),
 * and an unrounded `$multiply` would leak that drift into every consumer that
 * sums this expression across orders.
 */
export const MERCHANT_EARNINGS_EXPR = Object.freeze({
  $round: [{ $multiply: ['$pricing.subtotal', MERCHANT_FOOD_SHARE] }, 3],
});
