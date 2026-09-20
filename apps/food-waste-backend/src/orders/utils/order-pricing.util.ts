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
 * Balance at which commission settlement begins, in TND.
 *
 * Below this, the merchant is credited the **full** subtotal and the commission
 * simply accrues. See {@link calculateCommissionSettlement}.
 */
export const SETTLEMENT_THRESHOLD = 5.0;

/**
 * Hard ceiling on how much of a single order may be taken to settle commission.
 *
 * Without it a settlement order credits the merchant **zero**, which is the
 * worst moment this model can produce - a driver collecting a bag while the
 * merchant is paid nothing, with a customer watching. The cap guarantees the
 * merchant always keeps at least half of every order.
 *
 * It costs the platform nothing: unsettled balance carries to the next order
 * rather than being discarded, so collection is slower but the total is
 * identical.
 */
export const MAX_SETTLEMENT_SHARE_OF_ORDER = 0.5;

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

export interface CommissionSettlement {
  /**
   * `subtotal * PLATFORM_FOOD_SHARE`. Added to the balance on **every** order,
   * with no exception - including an order that settles.
   */
  accrued: number;
  /** Balance collected from this order. `0` on the large majority of orders. */
  settled: number;
  /** What the merchant is credited: `subtotal - settled`. */
  merchantAmount: number;
  /** Balance carried forward. Never negative. */
  commissionDueAfter: number;
}

/**
 * Decides, for one order, how much commission accrues and how much of the
 * merchant's outstanding balance is collected from it.
 *
 * ## The model
 *
 * The merchant is credited the **full** subtotal on almost every order. The 19%
 * is not deducted; it accrues into a per-establishment balance
 * (`Establishment.commissionDue`) and is collected in occasional lumps from
 * later orders. The take rate is unchanged - only the shape of collection is.
 *
 * ## Why accrual is unconditional
 *
 * It is tempting to skip the accrual on an order that settles: that order's
 * money goes entirely to the platform, so charging commission on it "as well"
 * reads like double-dipping. It is not, and skipping it is a silent 3-point
 * revenue leak.
 *
 * The balance is a **debt counter**, not revenue. A settling order is still a
 * sale - a customer paid for a bag - so it owes 19% like every other sale. The
 * settlement pays off *prior* debt; it does not exempt *this* sale.
 *
 * The arithmetic, at a 5 TND bag and a 5 TND threshold:
 *
 * ```
 *   skip accrual on settling orders → one settlement per 6.26 orders → 15.97%
 *   accrue on every order           → one settlement per 5.26 orders → 19.00%
 * ```
 *
 * Both rules are self-consistent; they are simply different prices. Only the
 * second one is the 19% this platform charges. Guarded by the convergence test
 * in `order-pricing.util.spec.ts`.
 *
 * ## Invariants
 *
 * - `accrued - settled` summed over all orders equals the outstanding balance,
 *   so nothing is ever discarded. This is why the balance is **decremented**
 *   rather than reset to zero: a reset would throw away the remainder and
 *   reward listing one cheap item while the balance is high.
 * - `merchantAmount >= subtotal * (1 - MAX_SETTLEMENT_SHARE_OF_ORDER)`.
 * - `commissionDueAfter >= 0`, because `settled <= balance` by construction.
 *
 * @param subtotal      Food total for this order. Never `pricing.total`.
 * @param commissionDue The establishment's balance *before* this order.
 */
export function calculateCommissionSettlement(
  subtotal: number,
  commissionDue: number,
): CommissionSettlement {
  const accrued = round(subtotal * PLATFORM_FOOD_SHARE);
  const balance = round(commissionDue + accrued);

  /*
   * Threshold is tested against the balance *after* accrual, so a single large
   * order can both accrue past the threshold and settle in one step. Testing
   * before accrual would delay every settlement by one order for no benefit.
   */
  let settled = 0;
  if (balance >= SETTLEMENT_THRESHOLD) {
    settled = round(Math.min(balance, round(subtotal * MAX_SETTLEMENT_SHARE_OF_ORDER)));
  }

  return {
    accrued,
    settled,
    merchantAmount: round(subtotal - settled),
    commissionDueAfter: round(balance - settled),
  };
}

/**
 * Mongo aggregation expression for a single order's merchant earnings.
 * Shared by every aggregation that reports what a merchant actually earned, as
 * opposed to what the customer paid. Splits `pricing.subtotal`, never
 * `pricing.total`.
 *
 * ## Two eras, one expression
 *
 * Under the commission-wallet model the merchant is credited the **full**
 * subtotal on most orders, and the platform's 19% accrues to
 * `Establishment.commissionDue` instead of being deducted per order. So a flat
 * `subtotal * 0.81` is no longer what the merchant earned — it under-reports
 * every order by 19%, silently, in three separate dashboards.
 *
 * `pricing.merchantAmount` is written at pickup confirmation and is the
 * authority when present. `$ifNull` falls back to the flat split for orders
 * confirmed **before** the model existed, which is why that field has no
 * schema default: a default of 0 would make `$ifNull` match and report every
 * historical order as zero earnings.
 *
 * ## Rounding
 *
 * Rounded to 3 decimals (millimes — see {@link round} above) for the same
 * reason `calculateFoodRevenueSplit` rounds in JS: `subtotal * 0.81` is not
 * exactly representable in IEEE-754 (e.g. `20 * 0.81 === 16.200000000000003`),
 * and an unrounded `$multiply` would leak that drift into every consumer that
 * sums this expression across orders. `pricing.merchantAmount` is already
 * rounded at write time, so `$round` is a no-op on that branch.
 */
export const MERCHANT_EARNINGS_EXPR = Object.freeze({
  $round: [
    {
      $ifNull: [
        '$pricing.merchantAmount',
        { $multiply: ['$pricing.subtotal', MERCHANT_FOOD_SHARE] },
      ],
    },
    3,
  ],
});
