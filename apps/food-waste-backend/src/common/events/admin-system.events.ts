/**
 * Base class for all admin system-level events
 * Provides common properties for audit trails and tracing
 */
export abstract class BaseAdminSystemEvent {
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    public readonly adminId: string,
    public readonly adminEmail: string,
    correlationId?: string,
  ) {
    this.timestamp = new Date();
    this.correlationId = correlationId;
  }
}

/**
 * Emitted when an admin updates system configuration
 * Triggers: cache invalidation, service config refresh, notification to admin team
 */
export class AdminSystemConfigChangedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly previousVersion: string,
    public readonly newVersion: string,
    public readonly changedFields: string[],
    public readonly previousValues: Record<string, unknown>,
    public readonly newValues: Record<string, unknown>,
    public readonly description?: string,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin rolls back system configuration
 * Triggers: emergency cache clear, service restart notifications, alert admin team
 */
export class AdminSystemConfigRolledBackEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly currentVersion: string,
    public readonly rolledBackToVersion: string,
    public readonly reason: string,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin enables/disables maintenance mode
 * Triggers: API gateway configuration, user notifications, service health updates
 */
export class AdminMaintenanceModeChangedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly enabled: boolean,
    public readonly reason?: string,
    public readonly estimatedDuration?: number, // minutes
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin changes critical security settings
 * Triggers: auth service refresh, session validation updates, security alert
 */
export class AdminSecurityConfigChangedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly changedSettings: string[],
    public readonly previousValues: Record<string, unknown>,
    public readonly newValues: Record<string, unknown>,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin changes payment settings
 * Triggers: payment service configuration update, payout recalculation
 */
export class AdminPaymentConfigChangedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly changedSettings: string[],
    public readonly previousValues: Record<string, unknown>,
    public readonly newValues: Record<string, unknown>,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin performs a bulk operation
 * Triggers: async job processing, progress notifications
 */
export class AdminBulkOperationStartedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly operationType: 'user_update' | 'data_export' | 'cleanup',
    public readonly targetCount: number,
    public readonly operationId: string,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}

/**
 * Emitted when an admin bulk operation completes
 * Triggers: completion notification, audit logging, analytics
 */
export class AdminBulkOperationCompletedEvent extends BaseAdminSystemEvent {
  constructor(
    adminId: string,
    adminEmail: string,
    public readonly operationType: 'user_update' | 'data_export' | 'cleanup',
    public readonly operationId: string,
    public readonly successCount: number,
    public readonly failureCount: number,
    public readonly totalCount: number,
    correlationId?: string,
  ) {
    super(adminId, adminEmail, correlationId);
  }
}
