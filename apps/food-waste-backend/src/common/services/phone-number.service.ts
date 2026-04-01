/**
 * Phone Number Service
 *
 * Provides comprehensive phone number operations using libphonenumber-js
 * Including validation, formatting, parsing, and phone number analysis
 *
 * @module PhoneNumberService
 * @see https://github.com/catamphetamine/libphonenumber-js
 */

import { Injectable } from '@nestjs/common';
import {
  parsePhoneNumber,
  isValidPhoneNumber,
  isPossiblePhoneNumber,
  validatePhoneNumberLength,
  getCountries,
  getCountryCallingCode,
  AsYouType,
  findPhoneNumbersInText,
  CountryCode,
  PhoneNumber,
  E164Number,
} from 'libphonenumber-js';

/**
 * Result of phone number validation
 */
export interface PhoneNumberValidationResult {
  isValid: boolean;
  isPossible?: boolean;
  error?: string;
  details?: PhoneNumberDetails;
}

/**
 * Detailed phone number information
 */
export interface PhoneNumberDetails {
  phoneNumber: PhoneNumber;
  formatted: {
    international: string; // +1 213 373 4253
    national: string; // (213) 373-4253
    e164: E164Number; // +12133734253
    uri: string; // tel:+12133734253
  };
  country?: CountryCode | undefined; // US, TN, FR, etc.
  countryCallingCode?: string | undefined; // 1, 216, 33, etc.
  nationalNumber?: string | undefined; // 2133734253
  type?: string | undefined; // MOBILE, FIXED_LINE, etc.
  isPossible: boolean;
  isValid: boolean;
}

/**
 * Phone number formatting options
 */
export interface PhoneNumberFormatOptions {
  /**
   * Format type
   * - 'international': +1 213 373 4253
   * - 'national': (213) 373-4253
   * - 'e164': +12133734253
   * - 'rfc3966': tel:+1-213-373-4253
   */
  format?: 'international' | 'national' | 'e164' | 'rfc3966';

  /**
   * Default country for parsing
   */
  defaultCountry?: CountryCode;
}

@Injectable()
export class PhoneNumberService {
  /**
   * Validate a phone number
   *
   * @param phoneNumber - Phone number string to validate
   * @param defaultCountry - Optional default country code
   * @returns Validation result with details
   *
   * @example
   * const result = service.validatePhoneNumber('+12133734253');
   * if (result.isValid) {
   *   console.log(result.details.formatted.international);
   * }
   *
   * @example
   * const result = service.validatePhoneNumber('20123456', 'TN');
   */
  validatePhoneNumber(
    phoneNumber: string,
    defaultCountry?: CountryCode,
  ): PhoneNumberValidationResult {
    try {
      // Quick possibility check
      const possible = isPossiblePhoneNumber(phoneNumber, defaultCountry);

      // Quick validity check
      const valid = isValidPhoneNumber(phoneNumber, defaultCountry);

      if (!valid) {
        // Get more detailed error
        const lengthValidation = validatePhoneNumberLength(phoneNumber, defaultCountry);

        return {
          isValid: false,
          isPossible: possible,
          error: this.getValidationErrorMessage(lengthValidation),
        };
      }

      // Parse for details
      const parsed = parsePhoneNumber(phoneNumber, defaultCountry);

      if (!parsed) {
        return {
          isValid: false,
          isPossible: possible,
          error: 'Failed to parse phone number',
        };
      }

      return {
        isValid: true,
        isPossible: true,
        details: this.getPhoneNumberDetails(parsed),
      };
    } catch {
      return {
        isValid: false,
        isPossible: false,
        error: error instanceof Error ? error.message : 'Invalid phone number',
      };
    }
  }

  /**
   * Parse and format a phone number
   *
   * @param phoneNumber - Phone number string
   * @param options - Formatting options
   * @returns Formatted phone number or null if invalid
   *
   * @example
   * service.formatPhoneNumber('+12133734253', { format: 'international' });
   * // Returns: +1 213 373 4253
   *
   * @example
   * service.formatPhoneNumber('20123456', {
   *   defaultCountry: 'TN',
   *   format: 'national'
   * });
   */
  formatPhoneNumber(phoneNumber: string, options: PhoneNumberFormatOptions = {}): string | null {
    try {
      const parsed = parsePhoneNumber(phoneNumber, options.defaultCountry);

      if (!parsed?.isValid()) {
        return null;
      }

      switch (options.format) {
        case 'national':
          return parsed.formatNational();
        case 'e164':
          return parsed.format('E.164');
        case 'rfc3966':
          return parsed.format('RFC3966');
        case 'international':
        default:
          return parsed.formatInternational();
      }
    } catch {
      return null;
    }
  }

  /**
   * Normalize phone number to E.164 format
   * E.164 is the international standard (+12133734253)
   *
   * @param phoneNumber - Phone number string
   * @param defaultCountry - Optional default country code
   * @returns E.164 formatted number or null if invalid
   *
   * @example
   * service.normalizePhoneNumber('(213) 373-4253', 'US');
   * // Returns: +12133734253
   */
  normalizePhoneNumber(phoneNumber: string, defaultCountry?: CountryCode): E164Number | null {
    try {
      const parsed = parsePhoneNumber(phoneNumber, defaultCountry);

      if (!parsed?.isValid()) {
        return null;
      }

      return parsed.format('E.164') as E164Number;
    } catch {
      return null;
    }
  }

  /**
   * Get detailed information about a phone number
   *
   * @param phoneNumber - Phone number string or PhoneNumber object
   * @param defaultCountry - Optional default country code
   * @returns Detailed phone number information or null
   */
  getPhoneNumberInfo(
    phoneNumber: string | PhoneNumber,
    defaultCountry?: CountryCode,
  ): PhoneNumberDetails | null {
    try {
      const parsed =
        typeof phoneNumber === 'string'
          ? parsePhoneNumber(phoneNumber, defaultCountry)
          : phoneNumber;

      if (!parsed) {
        return null;
      }

      return this.getPhoneNumberDetails(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Format phone number as you type (for real-time formatting in UI)
   *
   * @param partialNumber - Partial phone number being typed
   * @param defaultCountry - Optional default country code
   * @returns Formatted partial number
   *
   * @example
   * service.formatAsYouType('213373', 'US');
   * // Returns: (213) 373
   */
  formatAsYouType(partialNumber: string, defaultCountry?: CountryCode): string {
    const formatter = new AsYouType(defaultCountry);
    return formatter.input(partialNumber);
  }

  /**
   * Find and extract phone numbers from text
   *
   * @param text - Text containing phone numbers
   * @param defaultCountry - Optional default country code
   * @returns Array of found phone numbers with details
   *
   * @example
   * const text = 'Call me at +1 213 373 4253 or +33 1 42 86 82 00';
   * const numbers = service.findPhoneNumbersInText(text);
   * // Returns array with both numbers parsed
   */
  findPhoneNumbersInText(text: string, defaultCountry?: CountryCode): PhoneNumberDetails[] {
    try {
      const results = findPhoneNumbersInText(text, defaultCountry);

      return results.map((result) => this.getPhoneNumberDetails(result.number));
    } catch {
      return [];
    }
  }

  /**
   * Get all supported countries
   *
   * @returns Array of country codes
   */
  getSupportedCountries(): CountryCode[] {
    return getCountries();
  }

  /**
   * Get calling code for a country
   *
   * @param country - Country code (e.g., 'US', 'TN', 'FR')
   * @returns Calling code (e.g., '1', '216', '33')
   *
   * @example
   * service.getCountryCallingCode('TN'); // Returns: '216'
   */
  getCountryCallingCode(country: CountryCode): string {
    return getCountryCallingCode(country).toString();
  }

  /**
   * Check if two phone numbers are the same
   *
   * @param phoneNumber1 - First phone number
   * @param phoneNumber2 - Second phone number
   * @param defaultCountry - Optional default country code
   * @returns True if numbers are the same
   */
  arePhoneNumbersEqual(
    phoneNumber1: string,
    phoneNumber2: string,
    defaultCountry?: CountryCode,
  ): boolean {
    try {
      const normalized1 = this.normalizePhoneNumber(phoneNumber1, defaultCountry);
      const normalized2 = this.normalizePhoneNumber(phoneNumber2, defaultCountry);

      return normalized1 !== null && normalized1 === normalized2;
    } catch {
      return false;
    }
  }

  /**
   * Extract phone number details from PhoneNumber object
   * Private helper method
   */
  private getPhoneNumberDetails(phoneNumber: PhoneNumber): PhoneNumberDetails {
    return {
      phoneNumber,
      formatted: {
        international: phoneNumber.formatInternational(),
        national: phoneNumber.formatNational(),
        e164: phoneNumber.format('E.164') as E164Number,
        uri: phoneNumber.getURI(),
      },
      country: phoneNumber.country,
      countryCallingCode: phoneNumber.countryCallingCode?.toString(),
      nationalNumber: phoneNumber.nationalNumber?.toString(),
      type: phoneNumber.getType(),
      isPossible: phoneNumber.isPossible(),
      isValid: phoneNumber.isValid(),
    };
  }

  /**
   * Get user-friendly error message from validation result
   * Private helper method
   */
  private getValidationErrorMessage(validationResult: string | undefined): string {
    switch (validationResult) {
      case 'TOO_SHORT':
        return 'Phone number is too short';
      case 'TOO_LONG':
        return 'Phone number is too long';
      case 'INVALID_COUNTRY':
        return 'Invalid country code';
      case 'INVALID_LENGTH':
        return 'Phone number has invalid length';
      case 'NOT_A_NUMBER':
        return 'Not a valid phone number';
      default:
        return 'Invalid phone number';
    }
  }
}
