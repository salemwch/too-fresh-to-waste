import {
  AdminUserDeletedEvent,
  AdminUserRestoredEvent,
} from '../../common/events/admin-user.events';
import { AdminUserEventsListener } from './admin-user-events.listener';

describe('LoyaltyAdminUserEventsListener', () => {
  let listener: AdminUserEventsListener;
  let mockLoyaltyModel: { updateOne: jest.Mock };

  beforeEach(() => {
    mockLoyaltyModel = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    listener = new AdminUserEventsListener(mockLoyaltyModel as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('handleUserDeletedLegacy', () => {
    it('should deactivate loyalty account on user deletion', async () => {
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await listener.handleUserDeletedLegacy(event);

      expect(mockLoyaltyModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        { $set: { isActive: false, lastActivity: expect.any(Date) } },
      );
    });

    it('should not throw when update finds no documents', async () => {
      mockLoyaltyModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await expect(listener.handleUserDeletedLegacy(event)).resolves.toBeUndefined();
    });

    it('should not throw when database errors occur', async () => {
      mockLoyaltyModel.updateOne.mockRejectedValue(new Error('DB error'));
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await expect(listener.handleUserDeletedLegacy(event)).resolves.toBeUndefined();
    });
  });

  describe('handleUserRestoredLegacy', () => {
    it('should reactivate loyalty account on user restore', async () => {
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      expect(mockLoyaltyModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: false },
        { $set: { isActive: true, lastActivity: expect.any(Date) } },
      );
    });
  });

  describe('delete → restore lifecycle', () => {
    it('should deactivate on delete and reactivate on restore', async () => {
      const deleteEvent = new AdminUserDeletedEvent(
        'user-1',
        'admin-1',
        'admin@test.com',
        false,
        'test',
      );
      const restoreEvent = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserDeletedLegacy(deleteEvent);
      expect(mockLoyaltyModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        expect.objectContaining({ $set: expect.objectContaining({ isActive: false }) }),
      );

      mockLoyaltyModel.updateOne.mockClear();

      await listener.handleUserRestoredLegacy(restoreEvent);
      expect(mockLoyaltyModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: false },
        expect.objectContaining({ $set: expect.objectContaining({ isActive: true }) }),
      );
    });
  });
});
