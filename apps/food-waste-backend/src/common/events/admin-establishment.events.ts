import type { EstablishmentStatus } from '../enums/establishment.enum';

/**
 * Base class for all admin establishment-related events
 * Provides common properties for audit trails and tracing
 */
export abstract class BaseAdminEstablishmentEvent {
  public readonly timestamp: Date;
  public readonly correlationId?: string | undefined;

  constructor(
    public readonly establishmentId: string,
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
 * Emitted when an admin approves an establishment application
 * Triggers: search indexing, merchant onboarding, notification, analytics
 */
export class AdminEstablishmentApprovedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly establishmentName: string,
    public readonly ownerId: string,
    public readonly adminNotes?: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, undefined, correlationId);
  }
}

/**
 * Emitted when an admin rejects an establishment application
 * Triggers: notification to owner, analytics tracking
 */
export class AdminEstablishmentRejectedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly establishmentName: string,
    public readonly ownerId: string,
    public readonly rejectionReason: string,
    public readonly adminNotes?: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, rejectionReason, correlationId);
  }
}

/**
 * Emitted when an admin changes an establishment's status
 * Triggers: offer status updates, notification, search re-indexing
 */
export class AdminEstablishmentStatusChangedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly previousStatus: EstablishmentStatus,
    public readonly newStatus: EstablishmentStatus,
    reason?: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, reason, correlationId);
  }
}

/**
 * Emitted when an admin suspends an establishment
 * Triggers: deactivate all offers, cancel reservations, notify customers, search update
 */
export class AdminEstablishmentSuspendedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly establishmentName: string,
    public readonly ownerId: string,
    public readonly suspensionReason: string,
    public readonly reactivationDate?: Date,
    public readonly adminNotes?: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, suspensionReason, correlationId);
  }
}

/**
 * Emitted when an admin reactivates a suspended establishment
 * Triggers: enable offers, notification, search re-indexing, analytics
 */
export class AdminEstablishmentReactivatedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly establishmentName: string,
    public readonly ownerId: string,
    reason?: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, reason, correlationId);
  }
}

/**
 * Emitted when an admin verifies establishment documents
 * Triggers: status update, notification, badge assignment
 */
export class AdminEstablishmentVerifiedEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly establishmentName: string,
    public readonly ownerId: string,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, 'Documents verified', correlationId);
  }
}

/**
 * Emitted when an admin schedules establishment reactivation
 * Triggers: queue job scheduling, notification to owner
 */
export class AdminEstablishmentReactivationScheduledEvent extends BaseAdminEstablishmentEvent {
  constructor(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    public readonly reactivationDate: Date,
    correlationId?: string,
  ) {
    super(establishmentId, adminId, adminEmail, 'Reactivation scheduled', correlationId);
  }
}
