/**
 * User Domain Events
 * Events emitted by the users module for cross-module communication
 *
 * Event-Driven Benefits:
 * - Decoupling: Other modules react without tight coupling to UserService
 * - Asynchronous: Non-blocking side effects (emails, analytics, etc.)
 * - Audit Trail: Immutable log of user lifecycle events
 * - Extensibility: Add new listeners without modifying user module
 *
 * @module users/events
 */

/**
 * Emitted when a new user successfully registers
 * Listeners: Loyalty (signup bonus), Notifications (welcome email), Analytics
 */
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: string,
    public readonly phoneNumber?: string,
    public readonly registeredAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user verifies their email
 * Listeners: Notifications (confirmation email), Analytics, Gamification (achievement)
 */
export class UserEmailVerifiedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly verifiedAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user verifies their phone number
 * Listeners: Notifications (SMS confirmation), Analytics, Security (trust score)
 */
export class UserPhoneVerifiedEvent {
  constructor(
    public readonly userId: string,
    public readonly phoneNumber: string,
    public readonly verifiedAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user changes their password
 * Listeners: Security (invalidate sessions), Notifications (security alert email)
 */
export class UserPasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly changedAt: Date = new Date(),
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

/**
 * Emitted when user account is locked due to failed login attempts
 * Listeners: Security (admin notification), Notifications (user alert)
 */
export class UserAccountLockedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly lockedUntil: Date,
    public readonly reason: string,
    public readonly failedAttempts: number,
    public readonly lockedAt: Date = new Date(),
    public readonly ipAddress?: string,
  ) {}
}

/**
 * Emitted when admin unlocks a user account
 * Listeners: Notifications (user notification), Security (audit log)
 */
export class UserAccountUnlockedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly unlockedBy: string, // Admin user ID
    public readonly unlockedAt: Date = new Date(),
    public readonly ipAddress?: string,
  ) {}
}

/**
 * Emitted when user account status changes (suspended, deleted, etc.)
 * Listeners: Orders (cancel active orders), Sessions (invalidate tokens), Notifications
 */
export class UserStatusChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly reason?: string,
    public readonly changedAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user requests data deletion (GDPR/CCPA compliance)
 * Listeners: Orders, Favorites, Reviews, Notifications, Analytics (cascading deletion)
 */
export class UserDataDeletionRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly deletionType: 'soft_delete' | 'anonymization' | 'complete_deletion',
    public readonly reason?: string,
    public readonly requestedAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user data deletion is completed
 * For audit trail and notification purposes
 */
export class UserDataDeletionCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly deletionType: 'soft_delete' | 'anonymization' | 'complete_deletion',
    public readonly completedAt: Date = new Date(),
    public readonly dataRetained: string[] = [],
    public readonly dataAnonymized: string[] = [],
    public readonly dataDeleted: string[] = [],
  ) {}
}

/**
 * Emitted when user enables MFA (Multi-Factor Authentication)
 * Listeners: Security (audit log), Notifications (security confirmation email)
 */
export class UserMfaEnabledEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly mfaMethod: 'totp' | 'sms' | 'email',
    public readonly enabledAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user disables MFA
 * Listeners: Security (admin alert for high-value accounts), Notifications (security warning)
 */
export class UserMfaDisabledEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly disabledAt: Date = new Date(),
    public readonly reason?: string,
  ) {}
}

/**
 * Emitted when user updates privacy consent settings
 * Listeners: Analytics (compliance tracking), Admin (compliance dashboard update)
 */
export class UserPrivacyConsentUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly consentType: 'tunisia' | 'international',
    public readonly consents: {
      dataProcessingConsent?: boolean;
      locationTrackingConsent?: boolean;
      communicationConsent?: boolean;
      marketingOptIn?: boolean;
      analyticsOptIn?: boolean;
    },
    public readonly updatedAt: Date = new Date(),
    public readonly ipAddress?: string,
  ) {}
}

/**
 * Emitted when user profile is updated (significant changes only)
 * Listeners: Search Index (update), Cache (invalidate), Analytics
 *
 * Note: Not all profile updates should emit events - only significant ones
 * like email change, name change, role change
 */
export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly updatedFields: string[],
    public readonly updatedAt: Date = new Date(),
  ) {}
}

/**
 * Emitted when user account is restored from soft-delete
 * Listeners: Orders (restore soft-deleted orders), Notifications, Analytics
 */
export class UserAccountRestoredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly restoredBy: string, // Admin user ID
    public readonly restoredAt: Date = new Date(),
  ) {}
}
