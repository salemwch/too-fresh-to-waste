import { Types } from 'mongoose';

import { OrderCompletedEvent } from '../../common/events';
import { findInvalidDonationIds, OrderEventsListener } from '../listeners/order-events.listener';

import type { DonationsService } from '../donations.service';
import type { OrderDocument } from '../../orders/schemas/order.schema';
import type { Model } from 'mongoose';

const USER_ID = new Types.ObjectId().toString();
const ORDER_ID = new Types.ObjectId().toString();
const MERCHANT_ID = new Types.ObjectId().toString();
const ESTABLISHMENT_ID = new Types.ObjectId().toString();

function event(overrides: Partial<OrderCompletedEvent> = {}): OrderCompletedEvent {
  return {
    orderId: ORDER_ID,
    userId: USER_ID,
    merchantId: MERCHANT_ID,
    offerId: 'offer-1',
    totalAmount: 20,
    completedAt: new Date(),
    subtotalAmount: 20,
    establishmentId: ESTABLISHMENT_ID,
    ...overrides,
  } as OrderCompletedEvent;
}

describe('findInvalidDonationIds', () => {
  it('accepts an event whose three required ids are all valid ObjectIds', () => {
    expect(findInvalidDonationIds(event())).toEqual([]);
  });

  it.each([
    ['merchantId', { merchantId: 'not-an-object-id' }],
    ['userId', { userId: 'not-an-object-id' }],
    ['orderId', { orderId: 'not-an-object-id' }],
  ])('names %s when it is malformed', (field, override) => {
    expect(findInvalidDonationIds(event(override))).toEqual([field]);
  });

  it.each([
    ['an empty string', ''],
    ['a 12-character non-hex string', 'merchant0001'],
  ])('rejects %s', (_label, value) => {
    // Older bson accepted any 12-character string as a 12-byte id, which would
    // have built a real ObjectId from raw bytes and attributed the donation to
    // a merchant that does not exist. Verified against the bson in this
    // lockfile: isValid('merchant0001') is false and the constructor throws
    // BSONError. Both shapes are covered so a dependency bump that restores
    // the old leniency fails here rather than in production.
    const invalid = findInvalidDonationIds(event({ merchantId: value }));
    expect(invalid).toContain('merchantId');
  });

  it('names every malformed id, not just the first', () => {
    expect(
      findInvalidDonationIds(event({ userId: 'bad-user', merchantId: 'bad-merchant' })),
    ).toEqual(['userId', 'merchantId']);
  });
});

describe('OrderEventsListener donation id guard', () => {
  let donationsService: { createDonation: jest.Mock };
  let orderModel: { findById: jest.Mock };
  let listener: OrderEventsListener;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    donationsService = { createDonation: jest.fn().mockResolvedValue(undefined) };
    orderModel = {
      findById: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: jest.fn().mockResolvedValue({ establishmentId: new Types.ObjectId() }),
          }),
        }),
      }),
    };

    listener = new OrderEventsListener(
      donationsService as unknown as DonationsService,
      orderModel as unknown as Model<OrderDocument>,
    );

    errorSpy = jest
      .spyOn(listener['logger'] as unknown as { error: (msg: string) => void }, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(listener['logger'] as unknown as { warn: (msg: string) => void }, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn(listener['logger'] as unknown as { log: (msg: string) => void }, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a donation when every required id is valid', async () => {
    await listener.handleOrderCompletedLegacy(event());

    expect(donationsService.createDonation).toHaveBeenCalledTimes(1);
    const input = donationsService.createDonation.mock.calls[0]?.[0] as {
      merchantId: Types.ObjectId;
    };
    expect(input.merchantId.toString()).toBe(MERCHANT_ID);
  });

  it('refuses a malformed merchantId explicitly, naming the order and the field', async () => {
    // Honest about what the guard changes. With the bson in this lockfile,
    // `new Types.ObjectId('not-an-object-id')` throws, so the unguarded code
    // also failed to write a donation - it lost it to the catch at the bottom
    // of processOrderDonation and logged a generic "Failed to process" line
    // with no field name. So "createDonation was not called" alone does not
    // discriminate the fix from the bug, and it is asserted here only
    // alongside the log, which does: the order id and the offending field are
    // what make the dropped contribution traceable back to a sale.
    await listener.handleOrderCompletedLegacy(event({ merchantId: 'not-an-object-id' }));

    expect(donationsService.createDonation).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0]?.[0]);
    expect(message).toContain(ORDER_ID);
    expect(message).toContain('merchantId');
    expect(message).toContain('not-an-object-id');
    // A swallowed BSONError, not a refusal, would read like this.
    expect(message).not.toMatch(/Failed to process/i);
  });

  it('does not reach the establishment lookup once an id is refused', async () => {
    // No establishmentId on the event, so the unguarded path would fall back
    // to an order read before throwing. The guard returns first, which is
    // what makes this assertion discriminating rather than incidental.
    await listener.handleOrderCompletedLegacy(
      event({ merchantId: 'not-an-object-id', establishmentId: undefined }),
    );

    expect(orderModel.findById).not.toHaveBeenCalled();
    expect(donationsService.createDonation).not.toHaveBeenCalled();
  });

  it('refuses a malformed userId the same way, rather than losing the donation to the catch', async () => {
    await listener.handleOrderCompletedLegacy(event({ userId: 'not-an-object-id' }));

    expect(donationsService.createDonation).not.toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('userId');
  });

  it('does not run the guard at all when the donation amount rounds to zero', async () => {
    // A 0 TND subtotal produces no donation, so there is nothing to attribute
    // and nothing to refuse. Logging an error here would be noise.
    await listener.handleOrderCompletedLegacy(
      event({ subtotalAmount: 0, merchantId: 'not-an-object-id' }),
    );

    expect(donationsService.createDonation).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
