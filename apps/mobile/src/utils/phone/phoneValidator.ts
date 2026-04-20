/**
 * Phone Number Yup Validator
 * Custom Yup validator for phone numbers using libphonenumber-js
 *
 * Integrates seamlessly with existing Yup validation schemas
 * Matches backend validation logic for consistency
 */

import * as yup from 'yup';

import { isPossible, isValid, cleanPhoneNumber, DEFAULT_COUNTRY } from './phoneUtils';

import type { CountryCode } from 'libphonenumber-js/mobile';

/**
 * Phone number validation options
 */
interface PhoneValidatorOptions {
  /**
   * Default country code for validation
   * @default 'TN' (Tunisia - matches backend)
   */
  defaultCountry?: CountryCode;

  /**
   * Whether to allow national format (without country code)
   * @default true
   */
  allowNationalFormat?: boolean;

  /**
   * Require phone number in international format (+...)
   * @default false
   */
  requireInternationalFormat?: boolean;

  /**
   * Use strict validation (validates digits, not just length)
   * @default false (uses isPossiblePhoneNumber for future-proofing)
   */
  strictValidation?: boolean;

  /**
   * Custom error message
   */
  message?: string;
}

/**
 * Create a Yup phone number validator
 *
 * @param options - Validation options
 * @returns Yup string schema with phone validation
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: phoneNumberValidator({
 *     defaultCountry: 'TN',
 *     message: 'Invalid phone number'
 *   })
 * });
 * ```
 */
export const phoneNumberValidator = (options: PhoneValidatorOptions = {}) => {
  const {
    defaultCountry = DEFAULT_COUNTRY,
    allowNationalFormat = true,
    requireInternationalFormat = false,
    strictValidation = false,
    message = 'Please provide a valid phone number',
  } = options;

  return yup.string().test('is-phone-number', message, function (value) {
    const { path, createError } = this;

    // Empty value handling (use .required() separately if needed)
    if (!value || value.trim() === '') {
      return true;
    }

    // Clean the input
    const cleaned = cleanPhoneNumber(value);

    // Check if international format is required
    if (requireInternationalFormat && !cleaned.startsWith('+')) {
      return createError({
        path,
        message: 'Phone number must be in international format (e.g., +12133734253)',
      });
    }

    // Validate based on strictness level
    const validationFn = strictValidation ? isValid : isPossible;

    // Check if phone number is valid
    if (!validationFn(cleaned, defaultCountry)) {
      return createError({
        path,
        message: allowNationalFormat
          ? `${message} (international format +... or national format)`
          : `${message} (international format required, e.g., +12133734253)`,
      });
    }

    return true;
  });
};

/**
 * Required phone number validator
 * Combines required validation with phone number validation
 *
 * @param options - Validation options
 * @returns Yup string schema with required phone validation
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: requiredPhoneNumberValidator()
 * });
 * ```
 */
export const requiredPhoneNumberValidator = (options: PhoneValidatorOptions = {}) => {
  const { message = 'Phone number is required', ...rest } = options;

  return phoneNumberValidator({ ...rest, message }).required(message);
};

/**
 * Optional phone number validator
 * Validates phone number only if provided
 *
 * @param options - Validation options
 * @returns Yup string schema with optional phone validation
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: optionalPhoneNumberValidator()
 * });
 * ```
 */
export const optionalPhoneNumberValidator = (options: PhoneValidatorOptions = {}) =>
  phoneNumberValidator(options).nullable().optional();

/**
 * International phone number validator
 * Requires phone number to be in international format (+...)
 *
 * @param options - Validation options
 * @returns Yup string schema with international phone validation
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: internationalPhoneNumberValidator()
 * });
 * ```
 */
export const internationalPhoneNumberValidator = (options: PhoneValidatorOptions = {}) =>
  phoneNumberValidator({
    ...options,
    requireInternationalFormat: true,
    allowNationalFormat: false,
  });

/**
 * Strict phone number validator
 * Uses isValidPhoneNumber instead of isPossiblePhoneNumber
 *
 * @param options - Validation options
 * @returns Yup string schema with strict phone validation
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: strictPhoneNumberValidator()
 * });
 * ```
 */
export const strictPhoneNumberValidator = (options: PhoneValidatorOptions = {}) =>
  phoneNumberValidator({
    ...options,
    strictValidation: true,
  });

/**
 * Tunisia (TN) phone number validator
 * Validates phone numbers specifically for Tunisia
 * Matches backend configuration
 *
 * @param required - Whether phone number is required
 * @returns Yup string schema
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: tunisiaPhoneNumberValidator(true)
 * });
 * ```
 */
export const tunisiaPhoneNumberValidator = (required: boolean = false) => {
  const validator = phoneNumberValidator({
    defaultCountry: 'TN',
    allowNationalFormat: true,
    message: 'Please provide a valid Tunisian phone number',
  });

  return required ? validator.required('Phone number is required') : validator.nullable();
};

/**
 * Multi-country phone number validator
 * Validates phone numbers for multiple countries
 *
 * @param countries - Array of country codes to validate against
 * @param options - Validation options
 * @returns Yup string schema
 *
 * @example
 * ```ts
 * const schema = yup.object({
 *   phone: multiCountryPhoneNumberValidator(['TN', 'FR', 'US'])
 * });
 * ```
 */
export const multiCountryPhoneNumberValidator = (
  countries: CountryCode[],
  options: PhoneValidatorOptions = {},
) => {
  const { message = 'Please provide a valid phone number' } = options;

  return yup.string().test('is-multi-country-phone', message, function (value) {
    const { path, createError } = this;

    if (!value || value.trim() === '') {
      return true;
    }

    const cleaned = cleanPhoneNumber(value);

    // Check if valid for any of the countries
    const validForAnyCountry = countries.some(country => isPossible(cleaned, country));

    if (!validForAnyCountry) {
      return createError({
        path,
        message: `${message} for the selected countries`,
      });
    }

    return true;
  });
};
