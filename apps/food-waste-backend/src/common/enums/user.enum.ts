/**
 * User Role Enum
 *
 * Defines the roles available in the system for authorization and access control.
 *
 * @enum {string}
 */
export enum UserRole {
  /**
   * Regular consumer who purchases food items
   */
  CONSUMER = 'consumer',

  /**
   * Merchant/establishment owner who lists food offers
   */
  MERCHANT = 'merchant',

  /**
   * System administrator with full access
   */
  ADMIN = 'admin',

  /**
   * Content moderator with limited admin privileges
   */
  MODERATOR = 'moderator',
}

/**
 * User Status Enum
 *
 * Represents the current state of a user account in the system.
 *
 * @enum {string}
 */
export enum UserStatus {
  /**
   * Account created but email not verified
   */
  PENDING = 'pending',

  /**
   * Active account with full access
   */
  ACTIVE = 'active',

  /**
   * Temporarily suspended account (can be reactivated)
   */
  SUSPENDED = 'suspended',

  /**
   * Permanently blocked account
   */
  BLOCKED = 'blocked',

  /**
   * Soft-deleted account (data retained)
   */
  DELETED = 'deleted',

  /**
   * GDPR anonymized account (PII removed)
   */
  ANONYMIZED = 'anonymized',
}
