import { newOrderPayloadSchema } from '../use-merchant-orders-socket';

/**
 * `OrdersService.notifyMerchantNewOrder` sends `pricing: { subtotal }`, never
 * `pricing: { total }` - a merchant never sees delivery money. This test
 * feeds that exact stripped shape through the real Zod schema the socket
 * hook uses, so a schema that still required `pricing.total` (silently
 * failing every `order:new` event) would be caught here instead of in
 * production. See task-15-brief.md correction 3.
 */
describe('newOrderPayloadSchema - accepts the stripped backend payload', () => {
  it('accepts a payload whose pricing has only subtotal (the real shape)', () => {
    const payload = {
      event: 'order:new',
      data: {
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        customerName: 'Amira',
        pricing: { subtotal: 10 },
      },
    };

    const result = newOrderPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts a payload with no pricing at all', () => {
    const payload = { data: { orderId: 'order-1', orderNumber: 'ORD-1' } };
    expect(newOrderPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts a payload whose pricing carries the old `total` shape without `subtotal`, but never surfaces `total` as the price', () => {
    // `subtotal` is optional on `pricing` (task-17 B4 #3) for deploy skew with
    // a backend that has not shipped the field yet - the event must not fail
    // validation outright. The hook reads `data.pricing?.subtotal ?? null`,
    // so a payload that only carries `total` must resolve to `undefined`
    // here (and therefore `null` foodPrice downstream), never `17.777`.
    const payload = {
      data: { orderId: 'order-1', orderNumber: 'ORD-1', pricing: { total: 17.777 } },
    };

    const result = newOrderPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.success && result.data.data?.pricing?.subtotal).toBeUndefined();
  });

  it('still rejects a payload missing the required orderId', () => {
    const payload = { data: { orderNumber: 'ORD-1', pricing: { subtotal: 10 } } };
    expect(newOrderPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
