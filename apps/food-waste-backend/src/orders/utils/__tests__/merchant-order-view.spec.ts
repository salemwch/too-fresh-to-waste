import { toMerchantOrderView } from '../merchant-order-view';

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
