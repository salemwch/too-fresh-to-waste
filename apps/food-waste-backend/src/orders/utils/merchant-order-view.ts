/**
 * An order as a MERCHANT or LOCATION_MANAGER may receive it, over HTTP or a
 * socket emit. A merchant earns only from the food they sell; delivery is its
 * own financial flow (customer -> driver/platform) and belongs to the
 * platform, so no delivery-money figure is ever sent to them - not the
 * delivery fee, the customer's total, the driver's share, or the customer's
 * payment link. This is data minimisation: the field is not sent, rather than
 * merely hidden by the browser.
 *
 * ADMIN and the customer are never passed through this function - branch on
 * `req.user.role` at the call site and only call this for MERCHANT and
 * LOCATION_MANAGER. See `.claude/work/merchant-earnings.md` (Decisions) for
 * the full path-by-path classification and the route/emit list this was
 * applied to.
 *
 * `STRIP_PATHS` is the single source of truth: it drives both the deletion
 * logic below and the schema-driven coverage test
 * (`__tests__/merchant-order-view-schema-coverage.spec.ts`), which walks every
 * money-shaped path in `OrderSchema` and fails if a new one is neither here
 * nor in `KEEP_PATHS`.
 */

import { OrderSchema } from '../schemas/order.schema';

/** Dotted schema paths removed from a merchant/location-manager order view. */
export const STRIP_PATHS: ReadonlySet<string> = new Set([
  // Top-level delivery financials - the driver's and the platform's, never the merchant's.
  'deliveryFee',
  'driverEarnings',
  'platformDeliveryCommission',
  // The customer's payment link and gateway reference - not delivery money,
  // but a merchant has no business with a customer's pay URL either.
  'paymentSession',
  'paymentSession.provider',
  'paymentSession.reference',
  'paymentSession.payUrl',
  'paymentSession.expiresAt',
  // pricing: delivery fee and the customer-paid total (food + delivery).
  'pricing.deliveryFee',
  'pricing.total',
  // paymentDetails: what the customer paid, the gateway's cut, and gateway
  // references. `method` and `currency` are kept.
  'paymentDetails.amount',
  'paymentDetails.processingFee',
  'paymentDetails.stripePaymentIntentId',
  'paymentDetails.transactionId',
  // driverInstruction: the customer-paid collection amount (food + delivery)
  // and the driver's own share. `payMerchant` is what DriverCashService pays
  // the merchant from the float - `buildMerchantPickupCash` sets it to
  // `commission.merchantAmount`, the same food-only figure as
  // `order.commission.merchantAmount` - so it is food money and is kept,
  // along with `frozenAt` (a timestamp, not money). See
  // `drivers/utils/driver-cash.util.ts` `buildMerchantPickupCash`.
  'driverInstruction.collectFromCustomer',
  'driverInstruction.driverKeeps',
]);

/**
 * Every other `OrderSchema` path that matches the coverage test's money
 * regex but is deliberately kept, with why. Checked by the same test so an
 * unclassified field can never silently pass as "covered".
 */
export const KEEP_PATHS: ReadonlySet<string> = new Set([
  // Food prices, always the merchant's own.
  'items.unitPrice',
  'items.totalPrice',
  'items.originalPrice',
  'items.discountAmount',
  // pricing: food-only figures. `subtotal` matches the regex via "total".
  'pricing.subtotal',
  'pricing.discountAmount',
  'pricing.taxAmount',
  'pricing.merchantAmount',
  'pricing.commissionSettled',
  // Charity donation, from the platform margin, not delivery. Out of scope
  // for this view (see Task 15 brief) - kept as-is.
  'donationAmount',
  // The merchant's own frozen commission decision - never delivery money.
  'commission',
  'commission.model',
  'commission.kind',
  'commission.controlledBy',
  'commission.accrued',
  'commission.settled',
  'commission.merchantAmount',
  'commission.dueBefore',
  'commission.dueAfter',
  'commission.appliedAt',
  // The food money the driver owes the merchant, and when it was frozen.
  'driverInstruction.payMerchant',
  // Who collects the customer's payment (MERCHANT / DRIVER / PAYMENT_GATEWAY)
  // - an actor enum, not an amount.
  'paymentControl.collector',
  // Pickup-window boundary timestamps for the driver pool query - match the
  // regex only via the substring "collect" in "collection", not money.
  'collectionStartTime',
  'collectionEndTime',
]);

const overlap = [...STRIP_PATHS].filter(p => KEEP_PATHS.has(p));
if (overlap.length > 0) {
  // Fails at import time - a path cannot be both kept and stripped.
  throw new Error(
    `merchant-order-view: path(s) in both STRIP_PATHS and KEEP_PATHS: ${overlap.join(', ')}`,
  );
}

/**
 * Validates that every `STRIP_PATHS` entry can actually be removed by
 * `toMerchantOrderView`'s two-pass deletion below, which only understands two
 * shapes: a bare top-level key, or one level of nesting inside an object
 * whose parent otherwise stays (`pricing.total`). Two shapes it silently gets
 * wrong instead of erroring:
 *
 * - **Depth > 2.** `'a.b.c'` resolves to `head = 'a'`, `rest = 'b.c'`, and the
 *   deletion does `delete view.a['b.c']` - not a real key, so nothing is
 *   removed and the field ships.
 * - **An array-typed head** (e.g. a future `'items.serviceFee'`). `items` is
 *   an array of subdocuments; `{ ...order.items }` spreads it into a plain
 *   `{0: {...}, 1: {...}}` object (losing `Array.isArray`), and the later
 *   `delete` looks for a `serviceFee` key that was never there on the array
 *   itself either.
 *
 * Exported so both this file's own import-time call and a test can drive it
 * with a synthetic bad entry - the check the brief asked for, not a comment.
 */
export function assertStripPathsHandleable(
  paths: ReadonlySet<string>,
  schema: typeof OrderSchema = OrderSchema,
): void {
  for (const dotted of paths) {
    const segments = dotted.split('.');
    if (segments.length > 2) {
      throw new Error(
        `merchant-order-view: STRIP_PATHS entry '${dotted}' is ${segments.length} levels ` +
          'deep - toMerchantOrderView only handles a top-level key or one level of nesting. ' +
          'Extend the helper to handle this shape before adding the path.',
      );
    }

    const head = segments[0] as string;
    const headSchemaType = schema.path(head);
    if (headSchemaType?.instance === 'Array') {
      throw new Error(
        `merchant-order-view: STRIP_PATHS entry '${dotted}' is nested under array path ` +
          `'${head}' - toMerchantOrderView's shallow-clone strip does not handle array ` +
          'subdocuments. Extend the helper to handle this shape before adding the path.',
      );
    }
  }
}

assertStripPathsHandleable(STRIP_PATHS);

/** Top-level keys this view always removes - the return type below. */
export type MerchantOrderView<T> = Omit<
  T,
  'deliveryFee' | 'driverEarnings' | 'platformDeliveryCommission' | 'paymentSession'
>;

/**
 * A hydrated Mongoose document keeps its raw backing store on `_doc` as an
 * own enumerable property, alongside `$__` and friends. `{ ...doc }` copies
 * that reference as-is: the top-level fields on the spread result look
 * stripped, but `view._doc.pricing.total` is still the original object,
 * untouched, and reachable by `JSON.stringify`. Converting through
 * `toObject()` first (Mongoose's own plain-object export, which recurses
 * into subdocuments) removes `_doc`/`$__` entirely before the strip logic
 * ever runs, and does not mutate `order` - `toObject()` returns a new object.
 */
function toPlainIfHydrated<T extends object>(order: T): T {
  const maybeDoc = order as { toObject?: () => unknown };
  if (typeof maybeDoc.toObject === 'function') {
    return maybeDoc.toObject() as T;
  }
  return order;
}

/**
 * Returns a copy of `order` with every delivery-money field removed, per
 * `STRIP_PATHS`. Never mutates `order` or any of its nested objects - every
 * touched nested object (`pricing`, `paymentDetails`, `paymentSession`,
 * `driverInstruction`) is shallow-cloned before a key is deleted from it.
 *
 * Works on any plain object shape: a full order, a list element, a hydrated
 * Mongoose document, or a hand-built object that merely has a `pricing` key
 * (e.g. the receipt endpoint) - only the paths present are touched.
 */
export function toMerchantOrderView<T extends object>(order: T): MerchantOrderView<T> {
  const source = toPlainIfHydrated(order) as Record<string, unknown>;
  const view: Record<string, unknown> = { ...source };

  // Pass 1: whole-object removals (e.g. `paymentSession`). Done first so pass
  // 2 can skip re-creating an already-removed object from its individual
  // field entries (`paymentSession.payUrl`, kept in STRIP_PATHS purely so the
  // schema coverage test can classify it).
  const bareStripped = new Set<string>();
  for (const dotted of STRIP_PATHS) {
    if (!dotted.includes('.')) {
      delete view[dotted];
      bareStripped.add(dotted);
    }
  }

  // Pass 2: individual fields inside an object that is otherwise kept (e.g.
  // `pricing.total` - `pricing` itself stays).
  const cloned = new Set<string>();
  for (const dotted of STRIP_PATHS) {
    const dot = dotted.indexOf('.');
    if (dot === -1) {
      continue;
    }

    const head = dotted.slice(0, dot);
    if (bareStripped.has(head)) {
      continue;
    }
    const rest = dotted.slice(dot + 1);
    const original = source[head];
    if (!original || typeof original !== 'object') {
      continue;
    }

    if (!cloned.has(head)) {
      view[head] = { ...(original as Record<string, unknown>) };
      cloned.add(head);
    }
    delete (view[head] as Record<string, unknown>)[rest];
  }

  return view as MerchantOrderView<T>;
}
