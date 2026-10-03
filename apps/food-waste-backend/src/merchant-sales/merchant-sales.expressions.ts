import type { PipelineStage } from 'mongoose';

import { OrderStatus } from '../orders/schemas/order.schema';
import { MERCHANT_FOOD_SHARE } from '../orders/utils/order-pricing.util';

/**
 * The only definition of merchant earnings. Spec:
 * .claude/work/merchant-earnings.md (Definitions). Every consumer - summary,
 * chart, Payments, Analytics, the cutoff audit - builds on these; none keeps
 * its own copy.
 */

/**
 * Statuses that can carry a commission decision worth counting: the customer
 * has the food (PICKED_UP/COMPLETED/DELIVERED), or - for a delivery - the
 * driver has already collected it from the merchant and paid them from the
 * float, whether still en route (OUT_FOR_DELIVERY) or failed afterwards
 * (CANCELLED). `CommissionService.reverseForOrder` (the only path that undoes
 * a decision) adjusts the establishment balance and the ledger, never
 * `order.commission` itself (`drivers/services/driver-cash.service.ts`
 * `undoSale`), so a CANCELLED delivery counts the same regardless of recovery
 * - only REFUNDED (a distinct status, written by the admin refund flow)
 * removes an order from earnings. A delivery CANCELLED *before* driver
 * pickup has no commission moment (`driverPickedUpAt` unset) and is filtered
 * out by the moment check below, never by status.
 */
export const COMMISSION_COMPLETED_STATUSES: readonly OrderStatus[] = Object.freeze([
  OrderStatus.PICKED_UP,
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.CANCELLED,
]);

/**
 * When a sale completes for commission purposes: the business completion event,
 * not `commission.appliedAt`. The two commission call sites write this field
 * and `appliedAt` from one instant (held by a test in Task 9).
 */
export const COMMISSION_MOMENT_EXPR = Object.freeze({
  $cond: [
    { $eq: ['$deliveryMode', 'delivery'] },
    '$driverPickedUpAt',
    { $ifNull: ['$pickedUpAt', '$pickupDetails.actualPickupTime'] },
  ],
});

/**
 * Case 2 only: an order completed before the commission model existed and
 * carrying no decision was split 81/19 under the old model. Never used for an
 * order at or after the cutoff - that is case 3, an integrity failure.
 */
export const LEGACY_PRE_CUTOFF_MERCHANT_SHARE = MERCHANT_FOOD_SHARE;

export type SalesCase = 'CURRENT' | 'LEGACY' | 'UNVERIFIED';
export type SalesPopulation = 'earnings' | 'refunded' | 'verifying';
export type PaymentLine = 'cashStore' | 'cashDelivery' | 'online';

/** Cash orders carry no `paymentProvider`, so "not Konnect" is the cash test. */
export const PAYMENT_LINE_EXPR = Object.freeze({
  $cond: [
    { $eq: ['$paymentProvider', 'konnect'] },
    'online',
    { $cond: [{ $eq: ['$deliveryMode', 'delivery'] }, 'cashDelivery', 'cashStore'] },
  ],
});

const HAS_DECISION_EXPR = { $eq: [{ $type: '$commission' }, 'object'] };

function salesCaseExpr(cutoff: Date | null): object {
  return {
    $switch: {
      branches: [
        { case: HAS_DECISION_EXPR, then: 'CURRENT' },
        // Exact boundary: moment >= cutoff with no decision is an integrity failure.
        ...(cutoff ? [{ case: { $gte: ['$_moment', cutoff] }, then: 'UNVERIFIED' }] : []),
      ],
      default: 'LEGACY',
    },
  };
}

const POPULATION_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ['$status', OrderStatus.REFUNDED] }, then: 'refunded' },
      { case: { $eq: ['$_case', 'UNVERIFIED'] }, then: 'verifying' },
    ],
    default: 'earnings',
  },
};

/** Integer millimes, so every sum is exact and the invariants hold to the millime. */
const EARNED_MILLIMES_EXPR = {
  $toLong: {
    $round: [
      {
        $multiply: [
          {
            $switch: {
              branches: [
                { case: { $eq: ['$_case', 'CURRENT'] }, then: '$commission.merchantAmount' },
                {
                  case: { $eq: ['$_case', 'LEGACY'] },
                  then: {
                    $ifNull: [
                      '$pricing.merchantAmount',
                      {
                        $round: [
                          {
                            $multiply: [
                              { $ifNull: ['$pricing.subtotal', 0] },
                              LEGACY_PRE_CUTOFF_MERCHANT_SHARE,
                            ],
                          },
                          3,
                        ],
                      },
                    ],
                  },
                },
              ],
              default: 0,
            },
          },
          1000,
        ],
      },
      0,
    ],
  },
};

export function salesBaseStages(args: {
  scope: Record<string, unknown>;
  from: Date | null;
  to: Date;
  cutoff: Date | null;
}): PipelineStage[] {
  return [
    {
      $match: {
        ...args.scope,
        status: { $in: [...COMMISSION_COMPLETED_STATUSES, OrderStatus.REFUNDED] },
        isDeleted: { $ne: true },
      },
    },
    { $addFields: { _moment: COMMISSION_MOMENT_EXPR } },
    // No moment = never completed = not a sale (a refund before completion lands here).
    {
      $match: {
        _moment: { $type: 'date', ...(args.from ? { $gte: args.from } : {}), $lte: args.to },
      },
    },
    { $addFields: { _case: salesCaseExpr(args.cutoff), _line: PAYMENT_LINE_EXPR } },
    { $addFields: { _population: POPULATION_EXPR, _earnedMillimes: EARNED_MILLIMES_EXPR } },
  ];
}
