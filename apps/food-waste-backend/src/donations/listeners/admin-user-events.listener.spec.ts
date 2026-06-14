import { AdminUserDeletedEvent } from '../../common/events/admin-user.events';
import { AdminUserEventsListener } from './admin-user-events.listener';

describe('DonationsAdminUserEventsListener', () => {
  let listener: AdminUserEventsListener;
  let mockDonationModel: { updateMany: jest.Mock };
  let mockChain: { setOptions: jest.Mock };

  beforeEach(() => {
    mockChain = { setOptions: jest.fn().mockResolvedValue({ modifiedCount: 5 }) };
    mockDonationModel = {
      updateMany: jest.fn().mockReturnValue(mockChain),
    };
    listener = new AdminUserEventsListener(mockDonationModel as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('soft-delete on user deletion', () => {
    it('should soft-delete user donations with admin attribution', async () => {
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await listener.handleUserDeletedLegacy(event);

      expect(mockDonationModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: expect.any(Date),
            deletedBy: 'admin-1',
          },
        },
      );
      expect(mockChain.setOptions).toHaveBeenCalledWith({ includeDeleted: true });
    });

    it('should not throw when database errors occur', async () => {
      mockDonationModel.updateMany.mockReturnValue({
        setOptions: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await expect(listener.handleUserDeletedLegacy(event)).resolves.toBeUndefined();
    });
  });

  describe('no restore handler', () => {
    it('should not have a restore method (donations are financial records)', () => {
      expect(
        (listener as unknown as Record<string, unknown>)['handleUserRestoredLegacy'],
      ).toBeUndefined();
    });
  });
});
