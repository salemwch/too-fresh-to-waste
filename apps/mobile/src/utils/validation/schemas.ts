/**
 * Validation Schemas
 * Centralized Yup validation schemas for all forms
 *
 * Production Standards:
 * - Consistent error messages
 * - Reusable field validators
 * - Type-safe schemas
 * - Business logic validation
 */

import * as yup from 'yup';

import { phoneNumberValidator, requiredPhoneNumberValidator } from '../phone';

/**
 * Common Validators
 * Reusable validation rules
 */

// Email validation with strict TLD checking
const emailValidator = yup
  .string()
  .required('Email is required')
  .email('Please enter a valid email address')
  .lowercase()
  .trim()
  .test('valid-tld', 'Please enter a valid email address', value => {
    if (!value) return false;
    // Check if email has a valid TLD (at least 2 characters after the last dot)
    const tldMatch = value.match(/\.([a-z]{2,})$/i);
    return tldMatch?.[1] !== undefined && tldMatch[1].length >= 2;
  });

// Password validation
const passwordValidator = yup
  .string()
  .required('Password is required')
  .min(12, 'Password must be at least 12 characters')
  .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
  .matches(/[0-9]/, 'Password must contain at least one number')
  .matches(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

// Phone validation using libphonenumber-js
// Uses phoneNumberValidator from phone utilities for consistent validation with backend

// Phone validator (optional)
const phoneValidator = phoneNumberValidator({
  defaultCountry: 'TN',
  allowNationalFormat: true,
  message: 'Please provide a valid phone number',
}).nullable();

// Required phone validator
const requiredPhoneValidator = requiredPhoneNumberValidator({
  defaultCountry: 'TN',
  allowNationalFormat: true,
  message: 'Phone number is required',
});

// Required string
const requiredStringValidator = (fieldName: string) =>
  yup.string().required(`${fieldName} is required`).trim();

// Name validation (no numbers only, allows letters with spaces/hyphens)
const nameValidator = (fieldName: string) =>
  yup
    .string()
    .required(`${fieldName} is required`)
    .trim()
    .min(2, `${fieldName} must be at least 2 characters`)
    .max(50, `${fieldName} is too long`)
    .matches(
      /^(?!\d+$)[a-zA-ZÀ-ÿ\s'-]+$/,
      `${fieldName} must contain letters and cannot be only numbers`,
    );

// Price validation
const priceValidator = yup
  .number()
  .required('Price is required')
  .positive('Price must be greater than 0')
  .max(10000, 'Price cannot exceed $10,000');

// Quantity validation
const quantityValidator = yup
  .number()
  .required('Quantity is required')
  .integer('Quantity must be a whole number')
  .positive('Quantity must be greater than 0')
  .max(1000, 'Quantity cannot exceed 1,000');

/**
 * Auth Schemas
 */

export const loginSchema = yup.object({
  email: emailValidator,
  password: yup.string().required('Password is required'),
  rememberMe: yup.boolean(),
});

export const registerSchema = yup.object({
  firstName: nameValidator('First name'),
  lastName: nameValidator('Last name'),
  email: emailValidator,
  password: passwordValidator,
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  phoneNumber: requiredPhoneValidator, // Required - matches backend
  role: yup.string().required('Please select a role').oneOf(['consumer', 'merchant']),
  agreeToTerms: yup
    .boolean()
    .required('You must accept the terms and conditions')
    .oneOf([true], 'You must accept the terms and conditions'),
});

// Mobile-specific registration schema (phoneNumber deferred to order placement)
export const registerMobileSchema = yup.object({
  firstName: nameValidator('First name'),
  lastName: nameValidator('Last name'),
  email: emailValidator,
  password: passwordValidator,
});

export const forgotPasswordSchema = yup.object({
  email: emailValidator,
});

export const resetPasswordSchema = yup.object({
  password: passwordValidator,
});

/**
 * Offer Schemas
 */

const createOfferSchema = yup.object({
  title: requiredStringValidator('Title')
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title is too long'),
  description: requiredStringValidator('Description')
    .min(20, 'Description must be at least 20 characters')
    .max(500, 'Description is too long'),
  category: requiredStringValidator('Category'),
  originalPrice: priceValidator,
  discountedPrice: yup
    .number()
    .required('Discounted price is required')
    .positive('Discounted price must be greater than 0')
    .max(yup.ref('originalPrice'), 'Discounted price must be less than original price'),
  quantity: quantityValidator,
  pickupStartTime: yup
    .date()
    .required('Pickup start time is required')
    .min(new Date(), 'Pickup time cannot be in the past'),
  pickupEndTime: yup
    .date()
    .required('Pickup end time is required')
    .min(yup.ref('pickupStartTime'), 'End time must be after start time'),
  establishmentId: requiredStringValidator('Establishment'),
  allergens: yup.array().of(yup.string()),
  dietaryInfo: yup.array().of(yup.string()),
});

export const editOfferSchema = createOfferSchema.shape({
  // Allow editing with relaxed constraints
  pickupStartTime: yup.date().required('Pickup start time is required'),
});

/**
 * Establishment Schemas
 */

const createEstablishmentSchema = yup.object({
  name: requiredStringValidator('Establishment name')
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name is too long'),
  type: requiredStringValidator('Type').oneOf(
    ['restaurant', 'grocery', 'bakery', 'cafe', 'other'],
    'Invalid establishment type',
  ),
  description: yup.string().max(500, 'Description is too long').nullable(),
  address: yup.object({
    street: requiredStringValidator('Street address'),
    city: requiredStringValidator('City'),
    state: requiredStringValidator('State'),
    zipCode: requiredStringValidator('ZIP code').matches(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
    country: requiredStringValidator('Country'),
  }),
  phone: phoneValidator.required('Phone number is required'),
  email: emailValidator.nullable(),
  website: yup.string().url('Please enter a valid URL').nullable(),
  hours: yup.object({
    monday: yup.object({ open: yup.string(), close: yup.string() }),
    tuesday: yup.object({ open: yup.string(), close: yup.string() }),
    wednesday: yup.object({ open: yup.string(), close: yup.string() }),
    thursday: yup.object({ open: yup.string(), close: yup.string() }),
    friday: yup.object({ open: yup.string(), close: yup.string() }),
    saturday: yup.object({ open: yup.string(), close: yup.string() }),
    sunday: yup.object({ open: yup.string(), close: yup.string() }),
  }),
});

export const editEstablishmentSchema = createEstablishmentSchema;

/**
 * Profile Schemas
 */

export const editProfileSchema = yup.object({
  firstName: nameValidator('First name'),
  lastName: nameValidator('Last name'),
  email: emailValidator,
  phone: phoneValidator,
  bio: yup.string().max(500, 'Bio is too long').nullable(),
  address: yup
    .object({
      street: yup.string().nullable(),
      city: yup.string().nullable(),
      state: yup.string().nullable(),
      zipCode: yup
        .string()
        .matches(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
        .nullable(),
      country: yup.string().nullable(),
    })
    .nullable(),
});

export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: passwordValidator,
  confirmNewPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

/**
 * Checkout Schema
 */

export const checkoutSchema = yup.object({
  paymentMethod: requiredStringValidator('Payment method').oneOf(
    ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay'],
    'Invalid payment method',
  ),
  pickupTime: yup
    .date()
    .required('Pickup time is required')
    .min(new Date(), 'Pickup time cannot be in the past'),
  specialInstructions: yup.string().max(500, 'Special instructions are too long').nullable(),
  agreeToPickupPolicy: yup
    .boolean()
    .required('You must agree to the pickup policy')
    .oneOf([true], 'You must agree to the pickup policy'),
});

/**
 * Search Schema
 */

export const searchFiltersSchema = yup.object({
  query: yup.string().trim(),
  category: yup.string().nullable(),
  minPrice: yup.number().positive().nullable(),
  maxPrice: yup
    .number()
    .positive()
    .min(yup.ref('minPrice'), 'Max price must be greater than min price')
    .nullable(),
  distance: yup.number().positive().max(100, 'Distance cannot exceed 100 miles').nullable(),
  pickupDate: yup.date().nullable(),
  dietary: yup.array().of(yup.string()),
});

/**
 * Type Inference
 * Extract TypeScript types from schemas
 */

export type LoginFormData = yup.InferType<typeof loginSchema>;
export type RegisterFormData = yup.InferType<typeof registerSchema>;
export type RegisterMobileFormData = yup.InferType<typeof registerMobileSchema>;
export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;
export type CreateOfferFormData = yup.InferType<typeof createOfferSchema>;
export type EditOfferFormData = yup.InferType<typeof editOfferSchema>;
export type CreateEstablishmentFormData = yup.InferType<typeof createEstablishmentSchema>;
export type EditEstablishmentFormData = yup.InferType<typeof editEstablishmentSchema>;
export type EditProfileFormData = yup.InferType<typeof editProfileSchema>;
export type ChangePasswordFormData = yup.InferType<typeof changePasswordSchema>;
export type CheckoutFormData = yup.InferType<typeof checkoutSchema>;
export type SearchFiltersFormData = yup.InferType<typeof searchFiltersSchema>;

/**
 * Validation Schemas Summary:
 *
 * ✅ Auth Schemas (4)
 *    - Login, Register, Forgot Password, Reset Password
 *
 * ✅ Offer Schemas (2)
 *    - Create Offer, Edit Offer
 *
 * ✅ Establishment Schemas (2)
 *    - Create Establishment, Edit Establishment
 *
 * ✅ Profile Schemas (2)
 *    - Edit Profile, Change Password
 *
 * ✅ Checkout Schema (1)
 *
 * ✅ Search Schema (1)
 *
 * Total: 12 production-ready schemas
 *
 * Features:
 * - Type-safe with TypeScript inference
 * - Comprehensive validation rules
 * - User-friendly error messages
 * - Business logic validation
 * - Reusable validators
 * - Consistent patterns
 */
