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

  it('rejects a payload whose pricing carries the old `total` shape without `subtotal`', () => {
    // Guards the other direction: if the backend ever regresses back to
    // sending `{ total }` only, this documents that it would now fail to
    // validate `subtotal` (which is undefined) - not silently accept stale data.
    const payload = {
      data: { orderId: 'order-1', orderNumber: 'ORD-1', pricing: { total: 17.777 } },
    };

    const result = newOrderPayloadSchema.safeParse(payload);
    // `subtotal` is required once `pricing` is present; `total` alone does not satisfy it.
    expect(result.success).toBe(false);
  });

  it('still rejects a payload missing the required orderId', () => {
    const payload = { data: { orderNumber: 'ORD-1', pricing: { subtotal: 10 } } };
    expect(newOrderPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
