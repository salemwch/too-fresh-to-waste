import mongoose from 'mongoose';

import { OrderSchema } from '../../schemas/order.schema';
import {
  toMerchantOrderView,
  STRIP_PATHS,
  assertStripPathsHandleable,
} from '../merchant-order-view';

const order = {
  _id: 'o1',
  items: [{ offerTitle: 'Panier', quantity: 1, unitPrice: 10, originalPrice: 20 }],
  pricing: {
    subtotal: 10,
    discountAmount: 10,
    taxAmount: 0,
    deliveryFee: 4,
    total: 14,
    currency: 'TND',
    merchantAmount: 10,
    commissionSettled: 0,
  },
  paymentDetails: {
    method: 'pay_on_delivery',
    amount: 14,
    currency: 'TND',
    processingFee: 0.5,
    stripePaymentIntentId: 'pi_123',
    transactionId: 'txn_123',
  },
  paymentSession: {
    provider: 'konnect',
    reference: 'ref_1',
    payUrl: 'https://pay.example/session/1',
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  deliveryFee: 4,
  driverEarnings: 3.2,
  platformDeliveryCommission: 0.8,
  commission: { kind: 'NORMAL', merchantAmount: 10 },
  driverInstruction: {
    payMerchant: 10,
    collectFromCustomer: 14,
    driverKeeps: 3.2,
    frozenAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

describe('toMerchantOrderView', () => {
  it('removes every delivery-money field', () => {
    const view = toMerchantOrderView(order) as Record<string, unknown>;
    const json = JSON.stringify(view);
    for (const field of [
      '"deliveryFee"',
      '"driverEarnings"',
      '"platformDeliveryCommission"',
      '"total"',
      '"paymentSession"',
      '"payUrl"',
      '"amount"',
      '"processingFee"',
      '"stripePaymentIntentId"',
      '"transactionId"',
      '"collectFromCustomer"',
      '"driverKeeps"',
    ]) {
      expect(json).not.toContain(field);
    }
    expect(json).not.toContain('14');
    expect(json).not.toContain('3.2');
  });

  it('keeps the food figures and the merchant decision', () => {
    const view = toMerchantOrderView(order);
    expect(view.pricing).toEqual({
      subtotal: 10,
      discountAmount: 10,
      taxAmount: 0,
      currency: 'TND',
      merchantAmount: 10,
      commissionSettled: 0,
    });
    expect(view.commission).toEqual(order.commission);
    expect(view.items).toEqual(order.items);
  });

  it('keeps driverInstruction.payMerchant and frozenAt, drops the delivery-money fields', () => {
    const view = toMerchantOrderView(order);
    expect(view.driverInstruction).toEqual({
      payMerchant: 10,
      frozenAt: order.driverInstruction.frozenAt,
    });
  });

  it('strips paymentDetails down to method and currency', () => {
    const view = toMerchantOrderView(order);
    expect(view.paymentDetails).toEqual({ method: 'pay_on_delivery', currency: 'TND' });
  });

  it('strips paymentSession entirely', () => {
    const view = toMerchantOrderView(order) as Record<string, unknown>;
    expect(view['paymentSession']).toBeUndefined();
  });

  it('never mutates its input, deeply', () => {
    const before = structuredClone(order);
    toMerchantOrderView(order);
    expect(order).toEqual(before);
    expect(order.pricing.total).toBe(14);
    expect(order.paymentDetails.amount).toBe(14);
    expect(order.paymentSession.payUrl).toBe('https://pay.example/session/1');
    expect(order.driverInstruction.collectFromCustomer).toBe(14);
  });

  it('works on a lean object, a list element and an order with no pricing', () => {
    expect(() => toMerchantOrderView({ _id: 'x' })).not.toThrow();
    expect(toMerchantOrderView({ _id: 'x' })).toEqual({ _id: 'x' });
  });

  it('works on a hand-built object that only has a pricing key (the receipt endpoint)', () => {
    const receipt = {
      orderNumber: 'ORD-1',
      pricing: {
        subtotal: 10,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 4,
        total: 14,
        currency: 'TND',
      },
      pickupCode: '123456',
    };
    const view = toMerchantOrderView(receipt);
    expect(view.pricing).toEqual({
      subtotal: 10,
      discountAmount: 0,
      taxAmount: 0,
      currency: 'TND',
    });
    expect(view.pickupCode).toBe('123456');
  });
});

/**
 * IMPORTANT 1a (task-15-fix1-findings.md): STRIP_PATHS is supposed to be the
 * single source of truth, but the deletion logic only understands two shapes
 * (a bare top-level key, or one level of nesting). This test builds an order
 * object with EVERY STRIP_PATHS entry set to a sentinel, driven from
 * STRIP_PATHS itself, so a new entry that needs a shape the helper cannot
 * handle is caught here automatically instead of merely being "classified".
 */
describe('toMerchantOrderView - sentinel coverage of every STRIP_PATHS entry', () => {
  const SENTINEL = '__STRIP_SENTINEL__';

  function buildSentinelOrder(): Record<string, unknown> {
    const nestedByHead = new Map<string, string[]>();
    const bareKeys: string[] = [];

    for (const dotted of STRIP_PATHS) {
      const dot = dotted.indexOf('.');
      if (dot === -1) {
        bareKeys.push(dotted);
      } else {
        const head = dotted.slice(0, dot);
        const rest = dotted.slice(dot + 1);
        const list = nestedByHead.get(head) ?? [];
        list.push(rest);
        nestedByHead.set(head, list);
      }
    }

    const order: Record<string, unknown> = {};

    // A bare head is deleted whole by pass 1, whatever shape it is - bundle
    // any of its own nested STRIP entries into the same sentinel object so a
    // head is never both "a sentinel string" and "an object with sentinel
    // keys" at once.
    for (const head of bareKeys) {
      const nested = nestedByHead.get(head);
      order[head] = nested ? Object.fromEntries(nested.map(rest => [rest, SENTINEL])) : SENTINEL;
      nestedByHead.delete(head);
    }

    // Remaining heads are nested-only: the object itself stays, only some of
    // its keys are stripped.
    for (const [head, rests] of nestedByHead) {
      order[head] = Object.fromEntries(rests.map(rest => [rest, SENTINEL]));
    }

    return order;
  }

  it('has at least the known STRIP_PATHS entries (sanity check the builder itself)', () => {
    expect(STRIP_PATHS.size).toBeGreaterThan(0);
  });

  it('removes every STRIP_PATHS sentinel, however it is nested', () => {
    const order = buildSentinelOrder();
    const view = toMerchantOrderView(order);
    const json = JSON.stringify(view);

    expect(json).not.toContain(SENTINEL);
  });
});

/**
 * IMPORTANT 1b (task-15-fix1-findings.md): the two shapes `toMerchantOrderView`
 * silently gets wrong instead of erroring - a path deeper than two levels, and
 * a path nested under an array-typed schema head - must fail at import/call
 * time instead of shipping a field that looks classified but is never
 * actually removed.
 */
describe('assertStripPathsHandleable - the load-time guard', () => {
  it('throws for a path more than two levels deep', () => {
    expect(() => assertStripPathsHandleable(new Set(['a.b.c']))).toThrow(/levels deep/);
  });

  it('throws for a path nested under an array-typed OrderSchema path (e.g. items)', () => {
    expect(() => assertStripPathsHandleable(new Set(['items.serviceFee']))).toThrow(/array path/);
  });

  it('does not throw for a well-formed one-level-nested path', () => {
    expect(() => assertStripPathsHandleable(new Set(['pricing.total']))).not.toThrow();
  });

  it('does not throw for a well-formed bare top-level path', () => {
    expect(() => assertStripPathsHandleable(new Set(['deliveryFee']))).not.toThrow();
  });

  it('accepts a path whose head is not on the schema at all (nothing to check)', () => {
    expect(() => assertStripPathsHandleable(new Set(['notOnTheSchema.foo']))).not.toThrow();
  });

  it('accepts the real STRIP_PATHS set as it ships today', () => {
    expect(() => assertStripPathsHandleable(STRIP_PATHS)).not.toThrow();
  });
});

/**
 * IMPORTANT 1c (task-15-fix1-findings.md): a hydrated Mongoose document keeps
 * its raw backing store on `_doc` (and `$__`) as an own enumerable property.
 * `{ ...doc }` copies that reference as-is, so the untouched original survives
 * under a key the strip logic never looks at. `toMerchantOrderView` must
 * convert through `toObject()` first.
 */
describe('toMerchantOrderView - hydrated Mongoose documents', () => {
  const OrderModel: mongoose.Model<any> =
    (mongoose.models['Order'] as mongoose.Model<any> | undefined) ??
    mongoose.model('Order', OrderSchema);

  function buildHydratedOrder() {
    return new OrderModel({
      orderNumber: 'ORD-1',
      pricing: {
        subtotal: 10,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 4,
        total: 14,
        currency: 'TND',
      },
      paymentDetails: {
        method: 'cash',
        amount: 14,
        currency: 'TND',
        processingFee: 0.4,
      },
      driverInstruction: {
        payMerchant: 10,
        collectFromCustomer: 14,
        driverKeeps: 3.2,
      },
      deliveryFee: 4,
      driverEarnings: 3.2,
      platformDeliveryCommission: 0.8,
    });
  }

  it('is a real hydrated document, not a plain object (sanity check the fixture)', () => {
    const doc = buildHydratedOrder();
    expect(typeof (doc as unknown as { toObject: unknown }).toObject).toBe('function');
    expect(Object.prototype.hasOwnProperty.call(doc, '_doc')).toBe(true);
  });

  it('strips delivery money from a hydrated document, not just its top-level spread', () => {
    const doc = buildHydratedOrder();
    const view = toMerchantOrderView(doc) as Record<string, unknown>;
    const json = JSON.stringify(view);

    expect(json).not.toContain('"deliveryFee":4');
    expect(json).not.toContain('"driverEarnings"');
    expect(json).not.toContain('"driverKeeps"');
    expect(json).not.toContain('"total":14');
  });

  it('never leaks the original values back in via `_doc` or `$__`', () => {
    const doc = buildHydratedOrder();
    const view = toMerchantOrderView(doc) as Record<string, unknown>;

    // The regression this guards: `{ ...doc }` on a hydrated document copies
    // its `_doc`/`$__` bookkeeping by reference. If `toMerchantOrderView` ever
    // stops converting through `toObject()` first, this is what would still
    // carry the untouched pricing/deliveryFee through to `JSON.stringify`.
    expect(view).not.toHaveProperty('_doc');
    expect(view).not.toHaveProperty('$__');
  });

  it('does not mutate the original hydrated document', () => {
    const doc = buildHydratedOrder();
    toMerchantOrderView(doc);

    const raw = doc as unknown as {
      deliveryFee: number;
      pricing: { total: number };
      driverInstruction: { collectFromCustomer: number };
    };
    expect(raw.deliveryFee).toBe(4);
    expect(raw.pricing.total).toBe(14);
    expect(raw.driverInstruction.collectFromCustomer).toBe(14);
  });
});
