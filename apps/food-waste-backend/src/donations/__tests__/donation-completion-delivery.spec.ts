/**
 * order.completed -> donation: what happens when it cannot, or must not, be
 * recorded.
 *
 * - A failed write used to be caught and swallowed inside the listener, so the
 *   RabbitMQ handler acknowledged the message and the pledge for that sale was
 *   lost. It now reaches the handler, which Nacks for redelivery.
 * - A refund processed before the completion (a redelivered or delayed
 *   message) found nothing to reverse; the late completion then pledged for a
 *   refunded sale, forever.
 * - A payload with no subtotal gave NaN and skipped the donation silently.
 */

import { OrderStatus } from '@foodwaste/shared';
import { Nack } from '@golevelup/nestjs-rabbitmq';
import { Types } from 'mongoose';

import { OrderEventsListener } from '../listeners/order-events.listener';

import type { OrderCompletedEvent } from '../../common/events';
import type { OrderDocument } from '../../orders/schemas/order.schema';
import type { DonationsService } from '../donations.service';
import type { Model } from 'mongoose';

const ORDER_ID = new Types.ObjectId().toString();

const event = (overrides: Partial<OrderCompletedEvent> = {}): OrderCompletedEvent =>
  ({
    orderId: ORDER_ID,
    userId: new Types.ObjectId().toString(),
    merchantId: new Types.ObjectId().toString(),
    establishmentId: new Types.ObjectId().toString(),
    offerId: 'offer-1',
    totalAmount: 20,
    subtotalAmount: 20,
    completedAt: new Date(),
    ...overrides,
  }) as OrderCompletedEvent;

function setup(orderStatus: OrderStatus = OrderStatus.PICKED_UP) {
  const createDonation = jest.fn().mockResolvedValue(undefined);
  const orderModel = {
    findById: jest.fn(() => ({
      select: () => ({
        lean: () => ({ exec: jest.fn().mockResolvedValue({ status: orderStatus }) }),
      }),
    })),
  };
  const listener = new OrderEventsListener(
    { createDonation } as unknown as DonationsService,
    orderModel as unknown as Model<OrderDocument>,
  );
  const logger = listener['logger'] as unknown as Record<'log' | 'warn' | 'error', jest.Mock>;
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  return { listener, createDonation, error, warn };
}

afterEach(() => jest.restoreAllMocks());

describe('a donation write that fails', () => {
  it('is Nacked on RabbitMQ, so the broker redelivers it', async () => {
    const { listener, createDonation } = setup();
    createDonation.mockRejectedValue(new Error('primary stepped down'));

    const result = await listener.handleOrderCompletedRabbitMQ(event());

    expect(result).toBeInstanceOf(Nack);
  });

  it('is logged with the order id on EventEmitter, which cannot retry', async () => {
    const { listener, createDonation, error } = setup();
    createDonation.mockRejectedValue(new Error('primary stepped down'));

    await expect(listener.handleOrderCompletedLegacy(event())).resolves.toBeUndefined();

    expect(String(error.mock.calls[0]?.[0])).toContain(ORDER_ID);
  });

  it('a successful write is acknowledged (no Nack)', async () => {
    const { listener, createDonation } = setup();

    const result = await listener.handleOrderCompletedRabbitMQ(event());

    expect(createDonation).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });
});

describe('a completion that must not pledge', () => {
  it('skips an order that was already refunded', async () => {
    const { listener, createDonation, warn } = setup(OrderStatus.REFUNDED);

    await listener.handleOrderCompletedLegacy(event());

    expect(createDonation).not.toHaveBeenCalled();
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain('already refunded');
  });

  it.each([undefined, Number.NaN, 'twenty'])(
    'refuses a subtotal of %p, loudly',
    async subtotalAmount => {
      const { listener, createDonation, error } = setup();

      await listener.handleOrderCompletedLegacy(event({ subtotalAmount } as never));

      expect(createDonation).not.toHaveBeenCalled();
      expect(String(error.mock.calls[0]?.[0])).toContain(ORDER_ID);
    },
  );
});
