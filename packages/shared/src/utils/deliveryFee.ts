/**
 * Distance-based delivery fee - the SINGLE source for both apps.
 *
 * It lives in `packages/shared` for one reason: the checkout screen shows the
 * fee and the backend charges it, and they must agree. They previously did not.
 * Mobile carried its own `const DELIVERY_FEE_TND = 4` with a comment saying
 * "mirrors FLAT_DELIVERY_FEE in order.service.ts; change both together" - and
 * when the backend moved to distance bands, the app kept quoting a flat 4 TND.
 * A customer would have been shown one total and charged another.
 *
 * "Change both together" is not a mechanism. One module is.
 *
 * Distance-based delivery fee.
 *
 * Replaces a flat 4.00 TND charged regardless of distance, and the hard 5 km
 * gate that rejected anything further with a `BadRequestException`. Delivery is
 * now available at any distance; the price carries the cost instead of a cutoff.
 *
 * ## The bands
 *
 * ```
 *   up to  3   km   ->   2 TND
 *   up to  5.5 km   ->   5 TND
 *   up to  8.5 km   ->   8 TND
 *   up to 10.5 km   ->  10 TND
 *   up to 13.5 km   ->  13 TND
 *   beyond          ->  13 TND + 1 TND per additional 1.5 km, part-bands
 *                       rounded UP
 * ```
 *
 * Boundaries are upper-inclusive: exactly 5.5 km costs 5 TND, and 5.51 km costs
 * 8 TND. Stated explicitly because a customer at a band edge who is quoted one
 * price and charged another is a support ticket, and floating-point distances
 * land on those edges more often than intuition suggests.
 *
 * ## The first band ends at 3 km, not 2.5
 *
 * The bands as originally given ran `0-2.5` then `3.5-5.5`, leaving 2.5 to 3.5
 * km unpriced. Resolved by extending the FIRST band to 3 km, so a 3 km delivery
 * costs 2 TND and the table is contiguous: 0-3, 3-5.5, 5.5-8.5, 8.5-10.5,
 * 10.5-13.5. Every boundary is now shared, as the rest of the table already was.
 *
 * ## Why a table rather than a formula
 *
 * The bands are not linear - the step from 2 to 5 TND is 3, then 3, then 2,
 * then 3 - so any closed form would be a fit rather than the rule. A table is
 * what the business actually decided, and reads the same way the price list
 * does.
 */

/** One priced band. `upToKm` is inclusive. */
export interface DeliveryFeeBand {
  readonly upToKm: number;
  readonly fee: number;
}

export const DELIVERY_FEE_BANDS: readonly DeliveryFeeBand[] = Object.freeze([
  { upToKm: 3, fee: 2 },
  { upToKm: 5.5, fee: 5 },
  { upToKm: 8.5, fee: 8 },
  { upToKm: 10.5, fee: 10 },
  { upToKm: 13.5, fee: 13 },
]);

/** Where the table stops and the per-step rule takes over. */
export const DELIVERY_FEE_TABLE_LIMIT_KM = 13.5;

/** Fee at that limit, the base the per-step rule adds to. */
export const DELIVERY_FEE_AT_LIMIT = 13;

/** Every started step of this many km beyond the limit adds `STEP_FEE`. */
export const DELIVERY_FEE_STEP_KM = 1.5;
export const DELIVERY_FEE_STEP_FEE = 1;

/**
 * Distances arrive from `haversineKm`, so they are floats. Rounding to the
 * centimetre before comparing keeps a value like 5.500000000000001 - a real
 * output of that calculation - inside the 5.5 band instead of pricing it as
 * the next one up.
 */
const KM_EPSILON_PLACES = 2;
const roundKm = (km: number): number => Number(km.toFixed(KM_EPSILON_PLACES));

/**
 * @param distanceKm straight-line distance, from `haversineKm`.
 * @returns the fee in TND. Always at least the first band - a non-finite or
 *          negative distance cannot produce a free or negative delivery.
 */
export const calculateDeliveryFee = (distanceKm: number): number => {
  const first = DELIVERY_FEE_BANDS[0];
  /* istanbul ignore next - DELIVERY_FEE_BANDS is a frozen non-empty literal. */
  if (first === undefined) {
    return DELIVERY_FEE_AT_LIMIT;
  }

  // A missing or nonsense distance must not be cheaper than the shortest real
  // delivery, or a bad coordinate becomes a discount.
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return first.fee;
  }

  const km = roundKm(distanceKm);

  for (const band of DELIVERY_FEE_BANDS) {
    if (km <= band.upToKm) {
      return band.fee;
    }
  }

  // Beyond the table: every STARTED step adds a full step fee, so 13.6 km and
  // 15.0 km both cost 14 TND and 15.01 km costs 15.
  const beyond = km - DELIVERY_FEE_TABLE_LIMIT_KM;
  const steps = Math.ceil(beyond / DELIVERY_FEE_STEP_KM);
  return DELIVERY_FEE_AT_LIMIT + steps * DELIVERY_FEE_STEP_FEE;
};

// ============================================================================
// Splitting the fee
// ============================================================================

/**
 * Driver's share of the customer delivery fee.
 *
 * Configurable via `DELIVERY_DRIVER_SHARE` so the ratio can move without
 * touching business logic. This is the fallback when that is unset.
 *
 * ## Why a share and not a flat amount
 *
 * The driver used to receive a flat 3.00 TND. That is impossible under the
 * distance bands: a 2.5 km delivery collects 2.00 TND in total, so a flat 3.00
 * would have the platform paying 1.00 TND out of its own pocket on every short
 * trip - the exact failure the pricing model was rewritten to remove. A share
 * cannot produce that outcome at any fee.
 *
 * ## The platform's 33% is not margin
 *
 * It funds fuel and vehicle support where that applies, operations, payment
 * processing, failed deliveries, support, and logistics overhead. Recorded here
 * because a future reader looking only at the number will otherwise reasonably
 * assume it is profit and try to spend it.
 *
 * ## Scope
 *
 * This is the INDEPENDENT-driver model - a courier using their own scooter.
 * Salaried drivers are meant to be compensated separately (monthly salary plus
 * a controlled vehicle allowance) rather than by taking a large share of each
 * delivery. There are no salaried drivers yet, so no branch exists for them;
 * when one is added it belongs here rather than at the call site.
 *
 * ## Tips
 *
 * Tips go 100% to the driver and are NOT part of this split. Tipping is not
 * implemented anywhere yet, so there is nothing to route - when it is added it
 * must bypass this function entirely rather than pass through it.
 */
export const DEFAULT_DRIVER_SHARE = 0.67;

export interface DeliveryFeeSplit {
  /** What the driver is paid, in TND. */
  driverEarnings: number;
  /** What the platform keeps. Always exactly `fee - driverEarnings`. */
  platformCommission: number;
}

/** TND is quoted to the millime, but money paid out is rounded to the cent. */
const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/**
 * @param fee the customer delivery fee, from {@link calculateDeliveryFee}.
 * @param driverShare 0..1. Out-of-range or non-finite values fall back to the
 *        default rather than producing a negative or over-100% payout.
 */
export const splitDeliveryFee = (
  fee: number,
  driverShare: number = DEFAULT_DRIVER_SHARE,
): DeliveryFeeSplit => {
  const safeFee = Number.isFinite(fee) && fee > 0 ? fee : 0;
  const share =
    Number.isFinite(driverShare) && driverShare >= 0 && driverShare <= 1
      ? driverShare
      : DEFAULT_DRIVER_SHARE;

  /*
   * The driver's cut is rounded and the platform takes the remainder, rather
   * than rounding both. Rounding both independently lets them sum to a cent
   * more or less than the customer actually paid, which shows up as an
   * unexplained penny in settlement reconciliation and is miserable to trace.
   */
  const driverEarnings = roundMoney(safeFee * share);
  return {
    driverEarnings,
    platformCommission: roundMoney(safeFee - driverEarnings),
  };
};
