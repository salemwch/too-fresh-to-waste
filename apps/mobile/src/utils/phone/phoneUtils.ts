/**
 * Phone Number Utilities
 * Production-ready phone number handling using libphonenumber-js
 *
 * Features:
 * - Parse and validate international phone numbers
 * - Format for display (international, national)
 * - Real-time formatting as user types
 * - Support for Tunisia (TN) as default country (matches backend)
 * - E.164 format for storage
 *
 * @see https://github.com/catamphetamine/libphonenumber-js
 */

// Import from mobile-optimized version (works with React Native Metro bundler)
// Mobile version includes validation but is smaller than max (145 KB → 80 KB)
import {
  parsePhoneNumber,
  isPossiblePhoneNumber,
  isValidPhoneNumber as isValidPhoneNumberLib,
  AsYouType,
  validatePhoneNumberLength,
  getExampleNumber,
} from 'libphonenumber-js/mobile';
import examples from 'libphonenumber-js/mobile/examples';

import type { CountryCode, PhoneNumber, E164Number } from 'libphonenumber-js/mobile';

/**
 * Default country for phone number parsing
 * Set to Tunisia (TN) to match backend configuration
 */
export const DEFAULT_COUNTRY: CountryCode = 'TN';

/**
 * Supported countries for phone number input
 * Add more countries as needed for your application
 */
export const SUPPORTED_COUNTRIES: CountryCode[] = [
  'TN', // Tunisia - Default
  'FR', // France
  'US', // United States
  'GB', // United Kingdom
  'CA', // Canada
  'DE', // Germany
  'ES', // Spain
  'IT', // Italy
  'MA', // Morocco
  'DZ', // Algeria
  'EG', // Egypt
  'AE', // United Arab Emirates
  'SA', // Saudi Arabia
];

/**
 * Parse phone number from string
 *
 * @param phoneNumber - Phone number string (can be national or international)
 * @param defaultCountry - Default country code (defaults to TN)
 * @returns PhoneNumber object or null if invalid
 *
 * @example
 * ```ts
 * const phone = parsePhone('+1 (213) 373-4253');
 * console.log(phone?.number); // '+12133734253'
 * ```
 */
const parsePhone = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): PhoneNumber | null => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return null;
  }

  try {
    return parsePhoneNumber(phoneNumber, defaultCountry) ?? null;
  } catch {
    // Invalid phone number format
    return null;
  }
};

/**
 * Validate if phone number is possible
 * Uses isPossiblePhoneNumber for future-proof validation
 * (Recommended over isValidPhoneNumber as it only validates length)
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns True if phone number is possible
 *
 * @example
 * ```ts
 * isPossible('+12133734253'); // true
 * isPossible('123'); // false
 * ```
 */
export const isPossible = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): boolean => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return false;
  }

  try {
    return isPossiblePhoneNumber(phoneNumber, defaultCountry);
  } catch {
    return false;
  }
};

/**
 * Validate if phone number is valid
 * Checks both length and digit patterns
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns True if phone number is valid
 *
 * @example
 * ```ts
 * isValid('+12133734253'); // true
 * isValid('+1 (213) 373-4253'); // true
 * ```
 */
export const isValid = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): boolean => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return false;
  }

  try {
    return isValidPhoneNumberLib(phoneNumber, defaultCountry);
  } catch {
    return false;
  }
};

/**
 * Format phone number for display (international format)
 * Returns E.164 format: +12133734253
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns Formatted phone number or original string if invalid
 *
 * @example
 * ```ts
 * formatInternational('2133734253', 'US'); // '+1 213 373 4253'
 * formatInternational('+12133734253'); // '+1 213 373 4253'
 * ```
 */
export const formatInternational = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string => {
  const parsed = parsePhone(phoneNumber, defaultCountry);
  if (!parsed) {
    return phoneNumber;
  }

  return parsed.formatInternational();
};

/**
 * Format phone number in national format
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns Formatted phone number or original string if invalid
 *
 * @example
 * ```ts
 * formatNational('+12133734253'); // '(213) 373-4253'
 * ```
 */
export const formatNational = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string => {
  const parsed = parsePhone(phoneNumber, defaultCountry);
  if (!parsed) {
    return phoneNumber;
  }

  return parsed.formatNational();
};

/**
 * Get phone number in E.164 format for storage
 * This is the format expected by the backend
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns E.164 formatted number or null if invalid
 *
 * @example
 * ```ts
 * getE164Format('(213) 373-4253', 'US'); // '+12133734253'
 * getE164Format('+1 213 373 4253'); // '+12133734253'
 * ```
 */
export const getE164Format = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): E164Number | null => {
  const parsed = parsePhone(phoneNumber, defaultCountry);
  if (!parsed) {
    return null;
  }

  return parsed.number;
};

/**
 * Get country code from phone number
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @returns Country code or default country if not found
 *
 * @example
 * ```ts
 * getCountryCode('+12133734253'); // 'US'
 * getCountryCode('+33123456789'); // 'FR'
 * ```
 */
export const getCountryCode = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): CountryCode => {
  const parsed = parsePhone(phoneNumber, defaultCountry);
  return parsed?.country ?? defaultCountry;
};

/**
 * Format phone number as user types
 * Provides real-time formatting for better UX
 *
 * @param value - Current input value
 * @param country - Country code
 * @returns Formatted value
 *
 * @example
 * ```ts
 * formatAsYouType('2133', 'US'); // '(213) 3'
 * formatAsYouType('21337', 'US'); // '(213) 37'
 * ```
 */
const formatAsYouType = (value: string, country: CountryCode = DEFAULT_COUNTRY): string => {
  const formatter = new AsYouType(country);
  return formatter.input(value);
};

/**
 * Clean phone number (remove formatting)
 * Keeps only digits and + sign
 *
 * @param phoneNumber - Phone number string
 * @returns Cleaned phone number
 *
 * @example
 * ```ts
 * cleanPhoneNumber('+1 (213) 373-4253'); // '+12133734253'
 * cleanPhoneNumber('(213) 373-4253'); // '2133734253'
 * ```
 */
export const cleanPhoneNumber = (phoneNumber: string): string => phoneNumber.replace(/[^\d+]/g, '');

/**
 * Get phone number validation error message
 *
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Default country code
 * @param required - Whether phone number is required
 * @returns Error message or null if valid
 */
export const getPhoneValidationError = (
  phoneNumber: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
  required: boolean = true,
): string | null => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return required ? 'Phone number is required' : null;
  }

  // Clean the input
  const cleaned = cleanPhoneNumber(phoneNumber);

  // Check if it's a valid format
  if (!isPossible(cleaned, defaultCountry)) {
    return 'Please enter a valid phone number';
  }

  // Additional validation for specific formats
  if (!isValid(cleaned, defaultCountry)) {
    return 'Phone number format is invalid for the selected country';
  }

  return null;
};

/**
 * Get calling code for a country
 *
 * @param country - Country code
 * @returns Calling code (e.g., '1' for US, '216' for TN)
 *
 * @example
 * ```ts
 * getCallingCode('TN'); // '216'
 * getCallingCode('US'); // '1'
 * getCallingCode('FR'); // '33'
 * ```
 */
const getCallingCode = (country: CountryCode): string | undefined => {
  try {
    // Use getExampleNumber to get metadata, then extract calling code
    const exampleNumber = getExampleNumber(country, examples);
    if (exampleNumber) {
      return exampleNumber.countryCallingCode;
    }

    // Fallback: Try to parse an empty number with the country
    // This will give us access to the metadata
    const formatter = new AsYouType(country);
    formatter.input('1'); // Input a digit to trigger country detection
    const tempNumber = formatter.getNumber();
    if (tempNumber) {
      return tempNumber.countryCallingCode;
    }

    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Check if phone number has country code
 *
 * @param phoneNumber - Phone number string
 * @returns True if phone number starts with +
 */
export const hasCountryCode = (phoneNumber: string): boolean => phoneNumber.trim().startsWith('+');

/**
 * Sanitize phone number input
 * Removes invalid characters and ensures proper format
 *
 * @param value - Input value
 * @returns Sanitized value
 */
export const sanitizePhoneInput = (value: string): string => {
  // Remove all non-numeric characters except + and spaces
  let sanitized = value.replace(/[^\d+\s()-]/g, '');

  // Ensure + is only at the beginning
  const plusMatch = sanitized.match(/\+/g);
  if (plusMatch && plusMatch.length > 1) {
    sanitized = `+${sanitized.replace(/\+/g, '')}`;
  }

  return sanitized;
};

/**
 * Type guard to check if value is a valid E164 number
 */
export const isE164Number = (value: string): value is E164Number => /^\+[1-9]\d{1,14}$/.test(value);

/**
 * Get maximum phone number length for a specific country
 * Uses example numbers from libphonenumber-js metadata to determine max length
 *
 * @param country - Country code
 * @returns Maximum number of digits allowed (national number only, excluding country code)
 *
 * @example
 * ```ts
 * getMaxPhoneLength('TN'); // 8 (Tunisia)
 * getMaxPhoneLength('FR'); // 9 (France)
 * getMaxPhoneLength('US'); // 10 (United States)
 * ```
 */
const getMaxPhoneLength = (country: CountryCode): number => {
  try {
    // Get an example mobile number for the country
    const exampleNumber = getExampleNumber(country, examples);

    if (exampleNumber) {
      // Get the national number (without country code)
      const nationalNumber = exampleNumber.nationalNumber;
      return nationalNumber.length;
    }

    // Fallback: Use standard max length of 17 digits (ITU-T E.164 standard)
    return 17;
  } catch {
    // If metadata not available, return safe default
    return 17;
  }
};

/**
 * Validate phone number length for a specific country
 * Returns detailed status: 'TOO_SHORT', 'TOO_LONG', 'INVALID_COUNTRY', or undefined if valid
 *
 * @param phoneNumber - Phone number string
 * @param country - Country code
 * @returns Length validation status or undefined if valid
 *
 * @example
 * ```ts
 * validatePhoneLengthForCountry('12345', 'TN'); // 'TOO_SHORT'
 * validatePhoneLengthForCountry('12345678', 'TN'); // undefined (valid)
 * validatePhoneLengthForCountry('123456789012345', 'TN'); // 'TOO_LONG'
 * ```
 */
const validatePhoneLengthForCountry = (
  phoneNumber: string,
  country: CountryCode,
): 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_COUNTRY' | undefined => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return 'TOO_SHORT';
  }

  try {
    const result = validatePhoneNumberLength(phoneNumber, country);
    // Result can be 'TOO_SHORT', 'TOO_LONG', 'INVALID_LENGTH', 'IS_POSSIBLE_LOCAL_ONLY', 'IS_POSSIBLE', or undefined
    // We simplify to our return type
    if (result === 'TOO_SHORT' || result === 'TOO_LONG') {
      return result;
    }
    return undefined; // Valid length
  } catch {
    return 'INVALID_COUNTRY';
  }
};

/**
 * Check if phone number exceeds maximum length for country
 *
 * @param phoneNumber - Phone number string (can include formatting)
 * @param country - Country code
 * @returns True if phone number is too long
 *
 * @example
 * ```ts
 * isPhoneTooLong('12 34 56 78', 'TN'); // false
 * isPhoneTooLong('12 34 56 78 90', 'TN'); // true (TN max is 8 digits)
 * ```
 */
export const isPhoneTooLong = (phoneNumber: string, country: CountryCode): boolean => {
  const status = validatePhoneLengthForCountry(phoneNumber, country);
  return status === 'TOO_LONG';
};

/**
 * Check if phone number is too short for country
 *
 * @param phoneNumber - Phone number string
 * @param country - Country code
 * @returns True if phone number is too short
 */
export const isPhoneTooShort = (phoneNumber: string, country: CountryCode): boolean => {
  const status = validatePhoneLengthForCountry(phoneNumber, country);
  return status === 'TOO_SHORT';
};

/**
 * Enforce maximum length for phone number based on country
 * Truncates the input if it exceeds the maximum allowed digits
 *
 * @param input - Phone number input string
 * @param country - Country code
 * @returns Truncated phone number that respects max length
 *
 * @example
 * ```ts
 * enforceMaxLength('123456789', 'TN'); // '12345678' (max 8 digits for Tunisia)
 * enforceMaxLength('12345678901', 'US'); // '1234567890' (max 10 digits for US)
 * ```
 */
export const enforceMaxLength = (input: string, country: CountryCode): string => {
  // Clean the input to get only digits
  const cleaned = cleanPhoneNumber(input);
  const maxLength = getMaxPhoneLength(country);

  // Extract digits only (remove + sign)
  const digitsOnly = cleaned.replace(/\+/g, '');

  // Get calling code to preserve it
  const callingCode = getCallingCode(country);
  const callingCodeLength = callingCode ? callingCode.length : 0;

  // If input starts with +, check total length with calling code
  if (cleaned.startsWith('+')) {
    const totalMaxLength = callingCodeLength + maxLength;

    if (digitsOnly.length > totalMaxLength) {
      return `+${digitsOnly.substring(0, totalMaxLength)}`;
    }
    return cleaned;
  }

  // For national format, check against max length
  if (digitsOnly.length > maxLength) {
    return digitsOnly.substring(0, maxLength);
  }

  return cleaned;
};

/**
 * Get the number of digits in a phone number (excluding formatting)
 *
 * @param phoneNumber - Phone number string
 * @returns Number of digits
 *
 * @example
 * ```ts
 * getDigitCount('+216 20 123 456'); // 11 (includes country code)
 * getDigitCount('20 123 456'); // 8
 * ```
 */
export const getDigitCount = (phoneNumber: string): number => {
  const cleaned = cleanPhoneNumber(phoneNumber);
  return cleaned.replace(/\+/g, '').length;
};

/**
 * Country-specific max lengths (fallback if metadata not available)
 * These are the typical maximum lengths for mobile numbers
 */
export const COUNTRY_MAX_LENGTHS: Record<string, number> = {
  TN: 8, // Tunisia
  FR: 9, // France
  US: 10, // United States
  GB: 10, // United Kingdom
  CA: 10, // Canada
  DE: 11, // Germany
  ES: 9, // Spain
  IT: 10, // Italy
  MA: 9, // Morocco
  DZ: 9, // Algeria
  EG: 10, // Egypt
  AE: 9, // UAE
  SA: 9, // Saudi Arabia
};

/**
 * Get maximum INPUT length for TextInput (includes formatting characters)
 * This calculates the EXACT formatted length by actually formatting a max-length number
 *
 * This prevents the "flicker" issue where users can type beyond limit and see it disappear
 * By setting TextInput's maxLength to this value, typing is BLOCKED at keyboard level
 *
 * @param country - Country code
 * @returns Maximum characters allowed in input field (including all formatting)
 *
 * @example
 * ```ts
 * // Tunisia: Formats "99999999" and checks actual length
 * getMaxInputLength('TN'); // e.g., 16 for "+216 20 123 456"
 *
 * // USA: Formats "9999999999" and checks actual length
 * getMaxInputLength('US'); // e.g., 18 for "+1 (999) 999-9999"
 * ```
 */
export const getMaxInputLength = (country: CountryCode): number => {
  try {
    const nationalDigits = getMaxPhoneLength(country);
    const callingCode = getCallingCode(country);

    // Create a test number with maximum digits (all 9s)
    const testDigits = '9'.repeat(nationalDigits);

    // Format it to see actual formatted length
    let maxFormattedLength = 0;

    // Test national format (e.g., "20 123 456")
    const nationalFormatted = formatAsYouType(testDigits, country);
    maxFormattedLength = Math.max(maxFormattedLength, nationalFormatted.length);

    // Test international format (e.g., "+216 20 123 456")
    if (callingCode) {
      const internationalNumber = `+${callingCode}${testDigits}`;
      const internationalFormatted = formatAsYouType(internationalNumber, country);
      maxFormattedLength = Math.max(maxFormattedLength, internationalFormatted.length);
    }

    // Add small buffer (+1) for edge cases during typing
    return maxFormattedLength + 1;
  } catch {
    // Fallback: Conservative estimate
    const nationalDigits = getMaxPhoneLength(country);
    const callingCode = getCallingCode(country);
    const callingCodeLength = callingCode ? callingCode.length : 0;
    return 1 + callingCodeLength + nationalDigits + 8; // +8 for formatting buffer
  }
};
