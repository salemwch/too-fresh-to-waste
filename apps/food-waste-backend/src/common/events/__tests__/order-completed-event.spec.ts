import { plainToClass } from 'class-transformer';

import { OrderCompletedEvent } from '../order.events';

describe('OrderCompletedEvent', () => {
  it('carries establishmentId when constructed with one', () => {
    const event = new OrderCompletedEvent(
      'order-1',
      'user-1',
      'merchant-1',
      'offer-1',
      12.5,
      new Date(),
      { itemCount: 1 },
      10,
      'establishment-1',
    );

    expect(event.establishmentId).toBe('establishment-1');
    expect(event.subtotalAmount).toBe(10);
  });

  it('tolerates an old-shape message with no establishmentId', () => {
    // A message serialized by the previous release, still in the RabbitMQ queue
    // across a deploy. It must deserialize without throwing so the consumer can
    // fall back to an order lookup instead of Nacking into a requeue loop.
    const legacy = {
      orderId: 'order-2',
      userId: 'user-2',
      merchantId: 'merchant-2',
      offerId: 'offer-2',
      totalAmount: 20,
      completedAt: new Date().toISOString(),
      subtotalAmount: 18,
    };

    const event = plainToClass(OrderCompletedEvent, legacy);

    expect(event.establishmentId).toBeUndefined();
    expect(event.merchantId).toBe('merchant-2');
  });
});
