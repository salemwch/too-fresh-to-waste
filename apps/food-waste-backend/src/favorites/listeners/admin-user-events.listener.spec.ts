import {
  AdminUserDeletedEvent,
  AdminUserRestoredEvent,
} from '../../common/events/admin-user.events';
import { AdminUserEventsListener } from './admin-user-events.listener';

describe('FavoritesAdminUserEventsListener', () => {
  let listener: AdminUserEventsListener;
  let mockFavoriteModel: { updateMany: jest.Mock };
  let mockFavoriteListModel: { updateMany: jest.Mock };

  beforeEach(() => {
    mockFavoriteModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
    };
    mockFavoriteListModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    listener = new AdminUserEventsListener(
      mockFavoriteModel as never,
      mockFavoriteListModel as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('deactivate on delete', () => {
    it('should deactivate both favorites and favorite lists', async () => {
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await listener.handleUserDeletedLegacy(event);

      expect(mockFavoriteModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        { $set: { isActive: false } },
      );
      expect(mockFavoriteListModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        { $set: { isActive: false } },
      );
    });
  });

  describe('reactivate on restore', () => {
    it('should reactivate both favorites and favorite lists', async () => {
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      expect(mockFavoriteModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: false },
        { $set: { isActive: true } },
      );
      expect(mockFavoriteListModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: false },
        { $set: { isActive: true } },
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
      expect(mockFavoriteModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        expect.anything(),
      );

      mockFavoriteModel.updateMany.mockClear();
      mockFavoriteListModel.updateMany.mockClear();

      await listener.handleUserRestoredLegacy(restoreEvent);
      expect(mockFavoriteModel.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: false },
        expect.anything(),
      );
    });
  });
});
