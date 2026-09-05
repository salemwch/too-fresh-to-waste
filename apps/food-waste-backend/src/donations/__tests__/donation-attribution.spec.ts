import { Types } from 'mongoose';

import { resolveEstablishmentId } from '../listeners/order-events.listener';

describe('resolveEstablishmentId', () => {
  const orderId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();

  it('uses the id on the event and does not touch the database', async () => {
    const lookup = jest.fn();

    const result = await resolveEstablishmentId(
      orderId.toString(),
      establishmentId.toString(),
      lookup,
    );

    expect(result?.toString()).toBe(establishmentId.toString());
    expect(lookup).not.toHaveBeenCalled();
  });

  it('falls back to an order lookup when the event predates the field', async () => {
    const lookup = jest.fn().mockResolvedValue({ establishmentId });

    const result = await resolveEstablishmentId(orderId.toString(), undefined, lookup);

    expect(lookup).toHaveBeenCalledWith(orderId.toString());
    expect(result?.toString()).toBe(establishmentId.toString());
  });

  it('returns null rather than throwing when the order is gone', async () => {
    // A donation must never be lost because attribution could not be resolved.
    // The caller writes the donation with merchantId only and logs the gap.
    const lookup = jest.fn().mockResolvedValue(null);

    const result = await resolveEstablishmentId(orderId.toString(), undefined, lookup);

    expect(result).toBeNull();
  });

  it('returns null rather than throwing when the lookup itself fails', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('mongo down'));

    await expect(resolveEstablishmentId(orderId.toString(), undefined, lookup)).resolves.toBeNull();
  });

  it('falls through to the order lookup when the event id is malformed, instead of throwing', async () => {
    // `plainToClass` copies the RabbitMQ payload with no runtime validation, so
    // `establishmentId` on the event can be present but not a valid ObjectId. A
    // malformed id must degrade the same way a missing one does - fall back to
    // the order lookup - never construct `new Types.ObjectId(...)` off it and
    // throw, which would lose the whole donation, not just its attribution.
    const lookup = jest.fn().mockResolvedValue({ establishmentId });

    const result = await resolveEstablishmentId(orderId.toString(), 'not-an-object-id', lookup);

    expect(lookup).toHaveBeenCalledWith(orderId.toString());
    expect(result?.toString()).toBe(establishmentId.toString());
  });

  it('resolves to null rather than rejecting when the event id is malformed and the fallback lookup also fails', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('mongo down'));

    await expect(
      resolveEstablishmentId(orderId.toString(), 'not-an-object-id', lookup),
    ).resolves.toBeNull();
  });
});
