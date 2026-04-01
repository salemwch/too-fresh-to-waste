/**
 * Auth Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs to Zod schemas.
 * Single source of truth for auth validation across backend + mobile.
 *
 * @module shared/schemas/auth
 */
import { z } from 'zod';

import { UserRole } from '../enums';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SPECIAL_CHARS,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
} from '../validation/password-policy.constants';

// ============================================================================
// Reusable field schemas
// ============================================================================

/** Email field — trimmed + lowercased before validation */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address');

/** Password field with full NIST 800-63B policy */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_ERROR_MESSAGES.TOO_SHORT)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_ERROR_MESSAGES.TOO_LONG)
  .regex(
    buildPasswordRegex(),
    `Password must contain at least one uppercase, one lowercase, one number, and one special character (${PASSWORD_SPECIAL_CHARS})`,
  );

// ============================================================================
// Login
// ============================================================================

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================================================
// Register
// ============================================================================

const AddressComponentsSchema = z.object({
  street: z.string().max(200, 'Street cannot exceed 200 characters').optional(),
  city: z.string().max(100, 'City cannot exceed 100 characters').optional(),
  postalCode: z.string().max(20, 'Postal code cannot exceed 20 characters').optional(),
  country: z.string().max(100, 'Country cannot exceed 100 characters').optional(),
});

const BusinessInfoSchema = z.object({
  name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name cannot exceed 100 characters'),
  googlePlaceId: z
    .string()
    .min(1, 'Google Place ID is required')
    .max(300, 'Google Place ID cannot exceed 300 characters'),
  latitude: z
    .number({ message: 'Latitude must be a number' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ message: 'Longitude must be a number' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  formattedAddress: z
    .string()
    .min(1, 'Formatted address is required')
    .max(500, 'Formatted address cannot exceed 500 characters'),
  addressComponents: AddressComponentsSchema.optional(),
  types: z.array(z.string()).optional(),
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Last name must be at least 2 characters long')
    .max(50, 'Last name cannot exceed 50 characters'),
  phoneNumber: z.string().optional(),
  role: z.nativeEnum(UserRole, { message: 'Invalid user role' }).optional(),
  referralCode: z
    .string()
    .trim()
    .min(4, 'Referral code must be at least 4 characters')
    .max(20, 'Referral code cannot exceed 20 characters')
    .optional(),
  businessInfo: BusinessInfoSchema.optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ============================================================================
// Forgot Password
// ============================================================================

export const ForgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// ============================================================================
// Reset Password
// ============================================================================

export const ResetPasswordSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ============================================================================
// Verify Email
// ============================================================================

export const VerifyEmailSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Token is required'),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

// ============================================================================
// Sub-exports for nested schemas
// ============================================================================

export { AddressComponentsSchema, BusinessInfoSchema };
