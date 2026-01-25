/**
 * User Domain Events
 * Events emitted by the users module for cross-module communication
 *
 * @module common/events
 */

/**
 * Emitted when a new user successfully registers
 * Listeners: Loyalty (signup bonus), Notifications (welcome email), Analytics
 */
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly registeredAt: Date,
  ) {}
}

/**
 * Emitted when a user requests data deletion (GDPR compliance)
 * Listeners: Orders, Favorites, Reviews, Notifications, Analytics
 */
export class UserDataDeletionRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly requestedAt: Date,
    public readonly reason?: string,
  ) {}
}

/**
 * Emitted when user data deletion is completed
 * For audit trail and notification purposes
 */
export class UserDataDeletionCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly completedAt: Date,
    public readonly deletedRecords: {
      orders: number;
      favorites: number;
      reviews: number;
      notifications: number;
    },
  ) {}
}
