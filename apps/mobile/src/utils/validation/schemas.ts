/**
 * Validation Schemas
 * Centralized Yup validation schemas for auth forms
 *
 * Production Standards:
 * - Consistent error messages
 * - Reusable field validators
 * - Type-safe schemas
 */

import * as yup from 'yup';

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

/**
 * Auth Schemas
 */

export const loginSchema = yup.object({
  email: emailValidator,
  password: yup.string().required('Password is required'),
  rememberMe: yup.boolean(),
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
 * Type Inference
 * Extract TypeScript types from schemas
 */

export type LoginFormData = yup.InferType<typeof loginSchema>;
export type RegisterMobileFormData = yup.InferType<typeof registerMobileSchema>;
export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;
