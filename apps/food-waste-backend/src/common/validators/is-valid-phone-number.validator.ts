/**
 * Phone Number Validation Decorator
 *
 * Uses libphonenumber-js for comprehensive international phone number validation
 * Supports validation with or without default country
 *
 * @see https://github.com/catamphetamine/libphonenumber-js
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Options for phone number validation
 */
interface PhoneNumberValidationOptions extends ValidationOptions {
  /**
   * Default country code to use when validating numbers without country code
   * Example: 'US', 'TN', 'FR', etc.
   *
   * If not provided, phone numbers MUST include country code (E.164 format)
   */
  defaultCountry?: CountryCode;

  /**
   * Whether to allow national numbers without country code
   * Default: false (requires international format with +)
   */
  allowNationalFormat?: boolean;

  /**
   * Whether the field is required
   * Default: false (optional field)
   */
  required?: boolean;
}

/**
 * Custom validator constraint for phone numbers
 */
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  /**
   * Validates the phone number using libphonenumber-js
   *
   * @param value - The phone number to validate
   * @param args - Validation arguments containing options
   * @returns true if valid, false otherwise
   */
  validate(value: unknown, args: ValidationArguments): boolean {
    // Get options from decorator
    const options = (args.constraints[0] as PhoneNumberValidationOptions | undefined) ?? {};
    const { defaultCountry, allowNationalFormat = false, required = false } = options;

    // Handle optional fields
    if (value === null || value === undefined || value === '') {
      return !required; // Valid if not required, invalid if required
    }

    // Value must be a string
    if (typeof value !== 'string') {
      return false;
    }

    const trimmedValue = value.trim();

    // Empty after trim
    if (!trimmedValue) {
      return !required;
    }

    // Method 1: Quick validation
    if (defaultCountry) {
      // Validate with default country
      const isValid = isValidPhoneNumber(trimmedValue, defaultCountry);

      // If not valid with default country and national format is not allowed,
      // try as international number
      if (!isValid && !allowNationalFormat) {
        return isValidPhoneNumber(trimmedValue);
      }

      return isValid;
    }
    // No default country - must be international format
    return isValidPhoneNumber(trimmedValue);
  }

  /**
   * Default error message
   *
   * @param args - Validation arguments
   * @returns Error message
   */
  defaultMessage(args: ValidationArguments): string {
    const options = (args.constraints[0] as PhoneNumberValidationOptions | undefined) ?? {};
    const { defaultCountry, allowNationalFormat } = options;

    if (defaultCountry && allowNationalFormat === true) {
      return `${args.property} must be a valid phone number (international format with + or ${defaultCountry} national format)`;
    } else if (defaultCountry) {
      return `${args.property} must be a valid phone number in international format (e.g., +1234567890)`;
    }
    return `${args.property} must be a valid international phone number (e.g., +1234567890)`;
  }
}

/**
 * Phone Number Validation Decorator
 *
 * Validates phone numbers using Google's libphonenumber library
 *
 * @example
 * // Require international format (default)
 * class UserDTO {
 *   @IsValidPhoneNumber()
 *   phoneNumber: string;
 * }
 *
 * @example
 * // With default country (Tunisia)
 * class UserDTO {
 *   @IsValidPhoneNumber({ defaultCountry: 'TN' })
 *   phoneNumber: string;
 * }
 *
 * @example
 * // Allow national format
 * class UserDTO {
 *   @IsValidPhoneNumber({
 *     defaultCountry: 'TN',
 *     allowNationalFormat: true
 *   })
 *   phoneNumber: string;
 * }
 *
 * @example
 * // Required field
 * class UserDTO {
 *   @IsValidPhoneNumber({ required: true })
 *   phoneNumber: string;
 * }
 *
 * @param options - Validation options
 * @returns Property decorator
 */
export function IsValidPhoneNumber(options?: PhoneNumberValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: typeof propertyName === 'symbol' ? propertyName.toString() : propertyName,
      ...(options !== undefined ? { options } : {}),
      constraints: [options],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}
