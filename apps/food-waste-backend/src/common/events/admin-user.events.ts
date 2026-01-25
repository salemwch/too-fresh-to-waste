import { UserStatus } from '../enums/user.enum';

/**
 * Base class for all admin user-related events
 * Provides common properties for audit trails and tracing
 */
export abstract class BaseAdminUserEvent {
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    public readonly userId: string,
    public readonly adminId: string,
    public readonly adminEmail: string,
    public readonly reason?: string,
    correlationId?: string,
  ) {
    this.timestamp = new Date();
    this.correlationId = correlationId;
  }
}

/**
 * Emitted when an admin changes a user's status
 * Triggers: session revocation, order cancellation, offer deactivation
 */
export class AdminUserStatusChangedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    public readonly previousStatus: UserStatus,
    public readonly newStatus: UserStatus,
    reason?: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, reason, correlationId);
  }
}

/**
 * Emitted when an admin activates a user account
 * Triggers: notification, analytics tracking
 */
export class AdminUserActivatedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    reason?: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, reason, correlationId);
  }
}

/**
 * Emitted when an admin suspends a user account
 * Triggers: session revocation, order cancellation, notification, fraud detection
 */
export class AdminUserSuspendedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    public readonly suspensionReason: string,
    public readonly adminNotes?: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, suspensionReason, correlationId);
  }
}

/**
 * Emitted when an admin blocks a user account
 * Triggers: immediate session termination, order cancellation, security logging
 */
export class AdminUserBlockedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    public readonly blockReason: string,
    public readonly adminNotes?: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, blockReason, correlationId);
  }
}

/**
 * Emitted when an admin deletes a user account
 * Triggers: full cascade cleanup, data anonymization, analytics tracking
 */
export class AdminUserDeletedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    public readonly hardDelete: boolean,
    public readonly deletionReason: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, deletionReason, correlationId);
  }
}

/**
 * Emitted when an admin performs bulk user status updates
 * Triggers: async processing, batch notifications, analytics
 */
export class AdminBulkUserActionEvent {
  public readonly timestamp: Date;

  constructor(
    public readonly adminId: string,
    public readonly adminEmail: string,
    public readonly userIds: string[],
    public readonly action: 'activate' | 'suspend' | 'block',
    public readonly reason: string,
    public readonly correlationId?: string,
  ) {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when an admin updates a user's profile
 * Triggers: notification, audit logging
 */
export class AdminUserProfileUpdatedEvent extends BaseAdminUserEvent {
  constructor(
    userId: string,
    adminId: string,
    adminEmail: string,
    public readonly updatedFields: string[],
    public readonly previousValues: Record<string, unknown>,
    public readonly newValues: Record<string, unknown>,
    reason?: string,
    correlationId?: string,
  ) {
    super(userId, adminId, adminEmail, reason, correlationId);
  }
}
