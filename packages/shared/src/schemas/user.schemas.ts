/**
 * User Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-user, update-user,
 * update-password, update-location, verify-phone, send-phone-verification,
 * privacy-consent).
 *
 * @module shared/schemas/user
 */
import { z } from 'zod';

import { UserRole, UserStatus } from '../enums';

// ============================================================================
// Privacy-related enums (from users/interfaces/privacy-consent.interface.ts)
// ============================================================================

export enum ConsentType {
  PERSONAL_DATA_COLLECTION = 'personal_data_collection',
  EMAIL_MARKETING = 'email_marketing',
  PHONE_CONTACT = 'phone_contact',
  GPS_LOCATION = 'gps_location',
  ANALYTICS_TRACKING = 'analytics_tracking',
  THIRD_PARTY_SHARING = 'third_party_sharing',
  PROFILING = 'profiling',
}

export enum ConsentStatus {
  GIVEN = 'given',
  WITHDRAWN = 'withdrawn',
  PENDING = 'pending',
  EXPIRED = 'expired',
}

export enum LegalBasis {
  TN_EXPLICIT_CONSENT = 'tn_explicit_consent',
  TN_LEGITIMATE_INTEREST = 'tn_legitimate_interest',
  TN_CONTRACT_NECESSITY = 'tn_contract_necessity',
  GDPR_CONSENT = 'gdpr_consent',
  GDPR_CONTRACT = 'gdpr_contract',
  GDPR_LEGAL_OBLIGATION = 'gdpr_legal_obligation',
  GDPR_VITAL_INTERESTS = 'gdpr_vital_interests',
  GDPR_PUBLIC_TASK = 'gdpr_public_task',
  GDPR_LEGITIMATE_INTERESTS = 'gdpr_legitimate_interests',
  CCPA_BUSINESS_PURPOSE = 'ccpa_business_purpose',
  CCPA_SERVICE_PROVIDER = 'ccpa_service_provider',
}

// ============================================================================
// Create User (admin/internal)
// ============================================================================

export const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phoneNumber: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isEmailVerified: z.boolean().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ============================================================================
// Update User (profile update — excludes password & email)
// ============================================================================

const UserAddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  coordinates: z
    .object({
      type: z.string(),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
});

export const UpdateUserSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .transform(val => val || undefined)
    .optional(),
  role: z.nativeEnum(UserRole).optional(),
  avatar: z.string().optional(),
  profileImage: z.string().url('profileImage must be a valid URL').optional(),
  address: UserAddressSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================================================
// Update Password
// ============================================================================

export const UpdatePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]/,
      'Password must contain uppercase, lowercase, number, and special character',
    ),
});

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;

// ============================================================================
// Update Location
// ============================================================================

export const LOCATION_SOURCES = ['gps', 'network', 'passive', 'manual', 'ip'] as const;

export const UpdateLocationSchema = z.object({
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  locationName: z.string().max(255, 'Location name cannot exceed 255 characters').optional(),
  source: z.enum(LOCATION_SOURCES).optional(),
});

export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;

// ============================================================================
// Verify Phone
// ============================================================================

export const VerifyPhoneSchema = z.object({
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  code: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only digits'),
});

export type VerifyPhoneInput = z.infer<typeof VerifyPhoneSchema>;

// ============================================================================
// Send Phone Verification
// ============================================================================

export const SendPhoneVerificationSchema = z.object({
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  method: z
    .enum(['sms', 'voice'], { message: 'Verification method must be either "sms" or "voice"' })
    .optional()
    .default('sms'),
});

export type SendPhoneVerificationInput = z.infer<typeof SendPhoneVerificationSchema>;

// ============================================================================
// Privacy Consent DTOs
// ============================================================================

const ConsentRecordSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  status: z.nativeEnum(ConsentStatus),
  legalBasis: z.nativeEnum(LegalBasis),
  givenAt: z.string().datetime(),
  withdrawnAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  ipAddress: z.string().ip(),
  userAgent: z.string().min(1).max(500),
  consentVersion: z.string().min(1).max(50),
  processingPurpose: z.string().min(1).max(200),
  dataCategories: z.array(z.string()).min(1),
  retentionPeriod: z.number(),
  thirdParties: z.array(z.string()).optional(),
});

export const TunisianPrivacyConsentSchema = z.object({
  dataProcessingConsent: z.boolean(),
  locationTrackingConsent: z.boolean(),
  communicationConsent: z.boolean(),
  legalBasis: z.nativeEnum(LegalBasis),
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  consentVersion: z.string(),
});

export const InternationalPrivacyConsentSchema = TunisianPrivacyConsentSchema.extend({
  marketingOptIn: z.boolean(),
  analyticsOptIn: z.boolean(),
  thirdPartySharing: z.boolean(),
  profilingOptIn: z.boolean(),
  cookiesConsent: z.boolean(),
});

export const UpdatePrivacySettingsSchema = z.object({
  tunisianCompliance: TunisianPrivacyConsentSchema.optional(),
  internationalCompliance: InternationalPrivacyConsentSchema.optional(),
});

export const DataExportRequestSchema = z.object({
  format: z.enum(['json', 'csv', 'xml']),
  includeActivityData: z.boolean().optional(),
  includeApplicationData: z.boolean().optional(),
  legalBasis: z.enum(['data_portability', 'access_request', 'legal_obligation']).optional(),
});

export const DataDeletionRequestSchema = z.object({
  reason: z.string().min(10).max(500),
  deletionType: z.enum(['soft_delete', 'anonymization', 'complete_deletion']),
  retainLegalData: z.boolean().optional(),
  immediateProcessing: z.boolean().optional(),
});

export const ConsentWithdrawalSchema = z.object({
  consentType: z.nativeEnum(ConsentType),
  reason: z.string().min(5).max(200),
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  stopProcessingImmediately: z.boolean().optional(),
});

export type TunisianPrivacyConsentInput = z.infer<typeof TunisianPrivacyConsentSchema>;
export type InternationalPrivacyConsentInput = z.infer<typeof InternationalPrivacyConsentSchema>;
export type UpdatePrivacySettingsInput = z.infer<typeof UpdatePrivacySettingsSchema>;
export type DataExportRequestInput = z.infer<typeof DataExportRequestSchema>;
export type DataDeletionRequestInput = z.infer<typeof DataDeletionRequestSchema>;
export type ConsentWithdrawalInput = z.infer<typeof ConsentWithdrawalSchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export { ConsentRecordSchema, UserAddressSchema };
