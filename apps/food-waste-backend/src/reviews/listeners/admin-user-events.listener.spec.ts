import {
  AdminUserDeletedEvent,
  AdminUserRestoredEvent,
} from '../../common/events/admin-user.events';
import { AdminUserEventsListener } from './admin-user-events.listener';

describe('ReviewsAdminUserEventsListener', () => {
  let listener: AdminUserEventsListener;
  let mockReviewModel: { updateMany: jest.Mock };
  let mockChain: { setOptions: jest.Mock };

  beforeEach(() => {
    mockChain = { setOptions: jest.fn().mockResolvedValue({ modifiedCount: 2 }) };
    mockReviewModel = {
      updateMany: jest.fn().mockReturnValue(mockChain),
    };
    listener = new AdminUserEventsListener(mockReviewModel as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('cascade delete', () => {
    it('should soft-delete reviews with user_account_deleted reason', async () => {
      const event = new AdminUserDeletedEvent('user-1', 'admin-1', 'admin@test.com', false, 'test');

      await listener.handleUserDeletedLegacy(event);

      expect(mockReviewModel.updateMany).toHaveBeenCalledWith(
        { reviewerId: 'user-1', isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: expect.any(Date),
            deletedBy: 'admin-1',
            deletionReason: 'user_account_deleted',
          },
        },
      );
      expect(mockChain.setOptions).toHaveBeenCalledWith({ includeDeleted: true });
    });
  });

  describe('cascade restore', () => {
    it('should restore only cascade-deleted reviews', async () => {
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      expect(mockReviewModel.updateMany).toHaveBeenCalledWith(
        {
          reviewerId: 'user-1',
          isDeleted: true,
          deletionReason: 'user_account_deleted',
        },
        {
          $set: { isDeleted: false },
          $unset: { deletedAt: 1, deletedBy: 1, deletionReason: 1 },
        },
      );
    });
  });

  describe('moderation-deleted reviews are NOT restored', () => {
    it('should not match moderation-deleted reviews because deletionReason differs', async () => {
      // The query explicitly filters by deletionReason: 'user_account_deleted'
      // Moderation deletions use different reasons like 'Violates community guidelines'
      const event = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserRestoredLegacy(event);

      const updateFilter = mockReviewModel.updateMany.mock.calls[0][0];
      expect(updateFilter.deletionReason).toBe('user_account_deleted');
      // A moderation-deleted review with deletionReason: 'Violates guidelines'
      // would NOT match this filter
    });
  });

  describe('delete → restore lifecycle', () => {
    it('should soft-delete on user deletion and restore on user restoration', async () => {
      const deleteEvent = new AdminUserDeletedEvent(
        'user-1',
        'admin-1',
        'admin@test.com',
        false,
        'banned',
      );
      const restoreEvent = new AdminUserRestoredEvent('user-1', 'admin-1', 'admin@test.com');

      await listener.handleUserDeletedLegacy(deleteEvent);

      const deleteFilter = mockReviewModel.updateMany.mock.calls[0][0];
      const deleteUpdate = mockReviewModel.updateMany.mock.calls[0][1];
      expect(deleteFilter.reviewerId).toBe('user-1');
      expect(deleteUpdate.$set.deletionReason).toBe('user_account_deleted');

      mockReviewModel.updateMany.mockClear();
      mockChain.setOptions.mockResolvedValue({ modifiedCount: 2 });
      mockReviewModel.updateMany.mockReturnValue(mockChain);

      await listener.handleUserRestoredLegacy(restoreEvent);

      const restoreFilter = mockReviewModel.updateMany.mock.calls[0][0];
      expect(restoreFilter.deletionReason).toBe('user_account_deleted');
      expect(restoreFilter.isDeleted).toBe(true);
    });
  });
});
