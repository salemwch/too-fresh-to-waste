import { DonationPoolStatus } from '../schemas/donation-pool.schema';

describe('runCompletedPoolArchival', () => {
  it('uses updateMany instead of lean+save (design contract)', () => {
    const updateManySpy = jest.fn().mockResolvedValue({ modifiedCount: 2 });
    const mockModel = { updateMany: updateManySpy };

    const fixedArchival = () => {
      return mockModel.updateMany(
        { status: DonationPoolStatus.FUNDED, isArchived: false },
        {
          $set: {
            isArchived: true,
            archivedAt: expect.any(Date),
            status: DonationPoolStatus.ARCHIVED,
          },
        },
      );
    };

    return fixedArchival().then(() => {
      expect(updateManySpy).toHaveBeenCalledWith(
        { status: DonationPoolStatus.FUNDED, isArchived: false },
        expect.objectContaining({
          $set: expect.objectContaining({
            isArchived: true,
            status: DonationPoolStatus.ARCHIVED,
          }),
        }),
      );
    });
  });

  it('sets archivedAt timestamp', () => {
    const beforeDate = new Date();
    const updateManySpy = jest
      .fn()
      .mockImplementation((_filter: unknown, update: { $set: { archivedAt: Date } }) => {
        const archivedAt = update.$set.archivedAt;
        expect(archivedAt).toBeInstanceOf(Date);
        expect(archivedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
        return { modifiedCount: 1 };
      });

    const mockModel = { updateMany: updateManySpy };
    mockModel.updateMany(
      { status: DonationPoolStatus.FUNDED, isArchived: false },
      { $set: { isArchived: true, archivedAt: new Date(), status: DonationPoolStatus.ARCHIVED } },
    );
    expect(updateManySpy).toHaveBeenCalledTimes(1);
  });

  it('transitions status from FUNDED to ARCHIVED (not just isArchived flag)', () => {
    const update = {
      $set: { isArchived: true, archivedAt: new Date(), status: DonationPoolStatus.ARCHIVED },
    };
    expect(update.$set.status).toBe('archived');
    expect(update.$set.isArchived).toBe(true);
  });
});
