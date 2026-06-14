import {
  AdminUserDeletedEvent,
  AdminUserRestoredEvent,
} from '../../common/events/admin-user.events';
import { AdminUserEventsListener } from './admin-user-events.listener';

describe('NotificationsAdminUserEventsListener', () => {
  let listener: AdminUserEventsListener;
  let mockPrefModel: { updateOne: jest.Mock };

  beforeEach(() => {
    mockPrefModel = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    listener = new AdminUserEventsListener(mockPrefModel as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('sanitize on delete', () => {
    it('should clear device tokens and disable all channels', async () => {
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await listener.handleUserDeletedLegacy(event);

      expect(mockPrefModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1' },
        {
          $set: {
            deviceTokens: [],
            globalPushEnabled: false,
            globalEmailEnabled: false,
            globalSmsEnabled: false,
          },
        },
      );
    });
  });

  describe('restore', () => {
    it('should re-enable email only (push tokens must be re-registered)', async () => {
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      expect(mockPrefModel.updateOne).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { $set: { globalEmailEnabled: true } },
      );
    });

    it('should NOT re-enable push or SMS on restore', async () => {
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      const updateDoc = mockPrefModel.updateOne.mock.calls[0][1];
      expect(updateDoc.$set.globalPushEnabled).toBeUndefined();
      expect(updateDoc.$set.globalSmsEnabled).toBeUndefined();
    });
  });

  describe('delete → restore lifecycle', () => {
    it('should sanitize on delete then re-enable email on restore', async () => {
      const deleteEvent = new AdminUserDeletedEvent(
        'user-1',
        'admin-1',
        'admin@test.com',
        false,
        'test',
      );
      const restoreEvent = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserDeletedLegacy(deleteEvent);
      const deleteUpdate = mockPrefModel.updateOne.mock.calls[0][1];
      expect(deleteUpdate.$set.deviceTokens).toEqual([]);
      expect(deleteUpdate.$set.globalEmailEnabled).toBe(false);

      mockPrefModel.updateOne.mockClear();

      await listener.handleUserRestoredLegacy(restoreEvent);
      const restoreUpdate = mockPrefModel.updateOne.mock.calls[0][1];
      expect(restoreUpdate.$set.globalEmailEnabled).toBe(true);
    });
  });
});
