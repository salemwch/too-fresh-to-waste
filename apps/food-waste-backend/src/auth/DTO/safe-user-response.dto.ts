/**
 * Safe User Response DTO
 *
 * SECURITY: Only includes non-sensitive user information safe for client exposure.
 * All sensitive fields (passwordHistory, loginHistory, securitySettings, etc.)
 * are excluded to prevent information leakage.
 *
 * Reference: OWASP API Security Top 10 - API3:2023 Excessive Data Exposure
 */

import type { UserDocument } from '../../users/schemas/user.schema';
import type { UserRole, UserStatus } from '@foodwaste/shared';

/**
 * Minimal privacy settings safe for client
 */
export interface SafePrivacySettings {
  /** Tunisian data processing consent */
  dataProcessingConsent: boolean;
  /** Location tracking consent */
  locationTrackingConsent: boolean;
  /** Marketing communications consent */
  marketingOptIn: boolean;
  /** GDPR consent status */
  gdprConsentGiven: boolean;
}

/**
 * Safe user data returned to client after registration/login
 */
export interface SafeUserResponse {
  /** User unique identifier */
  userId: string;

  /** User email address */
  email: string;

  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;

  /** Phone number (optional) */
  phoneNumber?: string | undefined;

  /** User role (consumer, merchant, admin) */
  role: UserRole;

  /** Account status */
  status: UserStatus;

  /** Email verification status */
  isEmailVerified: boolean;

  /** Phone verification status */
  isPhoneVerified: boolean;

  /** Profile image URL (optional) */
  profileImage?: string | null | undefined;

  /** Minimal privacy settings */
  privacySettings?: SafePrivacySettings | undefined;

  /** Account creation date */
  createdAt: Date;

  /** Last update date */
  updatedAt: Date;

  /** Last login timestamp (optional) */
  lastLoginAt?: Date | undefined;
}

/**
 * Maps database user document to safe response DTO
 *
 * @param userDoc - Mongoose user document
 * @returns Safe user data for client
 */
export function mapToSafeUserResponse(userDoc: UserDocument): SafeUserResponse {
  // Extract only safe privacy settings
  const safePrivacySettings: SafePrivacySettings | undefined = userDoc.privacySettings
    ? {
        dataProcessingConsent:
          userDoc.privacySettings.tunisianCompliance?.dataProcessingConsent || false,
        locationTrackingConsent:
          userDoc.privacySettings.tunisianCompliance?.locationTrackingConsent || false,
        marketingOptIn: userDoc.privacySettings.internationalCompliance?.marketingOptIn || false,
        gdprConsentGiven:
          userDoc.privacySettings.internationalCompliance?.gdprConsentGiven || false,
      }
    : undefined;

  return {
    userId: userDoc._id?.toString() || userDoc.id,
    email: userDoc.email,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    phoneNumber: userDoc.phoneNumber,
    role: userDoc.role,
    status: userDoc.status,
    isEmailVerified: userDoc.isEmailVerified,
    isPhoneVerified: userDoc.isPhoneVerified,
    profileImage: userDoc.profileImage,
    privacySettings: safePrivacySettings,
    createdAt: userDoc.createdAt ?? new Date(),
    updatedAt: userDoc.updatedAt ?? new Date(),
    lastLoginAt: userDoc.lastLoginAt,
  };
}
