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
});
