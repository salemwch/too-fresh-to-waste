/**
 * Establishment Domain Events
 * Events emitted by the establishments module for cross-module communication
 *
 * @module common/events
 */

import type { EstablishmentStatus, EstablishmentType, DocumentType } from '@foodwaste/shared';

/**
 * Base class for all establishment-related events
 * Provides common properties for audit trails and tracing
 */
export abstract class BaseEstablishmentEvent {
  public readonly timestamp: Date;
  public readonly correlationId?: string | undefined;

  constructor(
    public readonly establishmentId: string,
    public readonly ownerId: string,
    correlationId?: string,
  ) {
    this.timestamp = new Date();
    this.correlationId = correlationId;
  }
}

/**
 * Emitted when a new establishment is created
 * Listeners: Analytics (track merchant signup), Notifications (confirmation), Admin (review queue)
 */
export class EstablishmentCreatedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly type: EstablishmentType,
    public readonly status: EstablishmentStatus,
    public readonly ownerEmail: string,
    public readonly address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
      coordinates: [number, number];
    },
    public readonly metadata?: {
      hasImages?: boolean;
      imageCount?: number;
      hasLegalDocuments?: boolean;
    },
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when establishment details are updated
 * Only emitted for significant changes (address, contact info, business hours, type)
 * NOT emitted for stats updates or internal metadata changes
 * Listeners: Search (re-indexing), Cache (invalidation), Analytics, Notifications (if address changed)
 */
export class EstablishmentUpdatedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly updatedFields: string[],
    public readonly changedData: {
      addressChanged?: boolean;
      contactChanged?: boolean;
      businessHoursChanged?: boolean;
      typeChanged?: boolean;
      previousAddress?: unknown;
      newAddress?: unknown;
    },
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when an establishment is soft-deleted
 * Listeners: Offers (deactivate all), Orders (cancel pending), Reviews (mark deleted), Analytics
 */
export class EstablishmentDeletedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly deletedBy: string,
    public readonly deletionReason: string,
    public readonly isAdminDeletion: boolean,
    public readonly metadata: {
      totalOffers?: number;
      pendingOrders?: number;
      totalReviews?: number;
    },
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when a legal document is uploaded
 * Listeners: Admin (verification queue), Notifications, Compliance (tracking), Analytics
 */
export class EstablishmentDocumentUploadedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly documentType: DocumentType,
    public readonly documentUrl: string,
    public readonly uploadedBy: string,
    public readonly metadata: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      expiryDate?: Date | undefined;
    },
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when a legal document is verified (admin only)
 * Listeners: Notifications (merchant notification), Analytics, Compliance (audit trail)
 * May trigger establishment approval if all required documents are verified
 */
export class EstablishmentDocumentVerifiedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly documentType: DocumentType,
    public readonly verifiedBy: string,
    public readonly verifiedByEmail: string,
    public readonly allDocumentsVerified: boolean,
    public readonly notes?: string,
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when a legal document is deleted
 * Listeners: Admin (notify for re-verification), Analytics, Compliance (audit trail)
 */
export class EstablishmentDocumentDeletedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly documentType: DocumentType,
    public readonly deletedBy: string,
    public readonly isAdminDeletion: boolean,
    public readonly reason?: string,
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when establishment stats are updated
 * Triggered by external events (order completion, review submission)
 * Listeners: Analytics (performance tracking), Cache (invalidation), Search (ranking update)
 */
export class EstablishmentStatsUpdatedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly statsChanged: {
      averageRating?: number;
      totalReviews?: number;
      totalOffers?: number;
      completedOrders?: number;
    },
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}

/**
 * Emitted when establishment images are updated
 * Listeners: CDN (cache invalidation), Search (re-indexing with new images), Analytics
 */
export class EstablishmentImagesUpdatedEvent extends BaseEstablishmentEvent {
  constructor(
    establishmentId: string,
    ownerId: string,
    public readonly establishmentName: string,
    public readonly imagesAdded: string[],
    public readonly imagesRemoved: string[],
    public readonly totalImages: number,
    correlationId?: string,
  ) {
    super(establishmentId, ownerId, correlationId);
  }
}
