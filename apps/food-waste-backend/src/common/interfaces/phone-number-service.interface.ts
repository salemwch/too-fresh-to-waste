/**
 * Phone number validation result
 */
export interface PhoneNumberValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    formatted: {
      e164: string;
      national: string;
      international: string;
    };
    country: string;
    type?: string;
  };
}

/**
 * Interface for Phone Number Service
 *
 * Abstraction layer for phone number validation and formatting.
 * Enables dependency inversion and facilitates testing with mocks.
 *
 * @enterprise-pattern Dependency Inversion Principle (SOLID)
 * @testing Easy to mock for unit tests without libphonenumber-js dependency
 */
export interface IPhoneNumberService {
  /**
   * Validate and parse phone number
   * @param phoneNumber Phone number to validate
   * @param defaultCountry Default country code (e.g., 'TN' for Tunisia)
   * @returns Validation result with formatted phone numbers
   */
  validatePhoneNumber(phoneNumber: string, defaultCountry?: string): PhoneNumberValidationResult;

  /**
   * Format phone number to E.164 format
   * @param phoneNumber Phone number to format
   * @param defaultCountry Default country code
   * @returns Formatted phone number in E.164 format (e.g., +21620123456)
   */
  formatToE164(phoneNumber: string, defaultCountry?: string): string | null;

  /**
   * Format phone number to national format
   * @param phoneNumber Phone number to format
   * @param defaultCountry Default country code
   * @returns Formatted phone number in national format
   */
  formatToNational(phoneNumber: string, defaultCountry?: string): string | null;
}

/**
 * Injection token for IPhoneNumberService
 * Use this token in constructor injection instead of the concrete class
 *
 * @example
 * constructor(@Inject(PHONE_NUMBER_SERVICE_TOKEN) private readonly phoneNumberService: IPhoneNumberService) {}
 */
export const PHONE_NUMBER_SERVICE_TOKEN = Symbol('IPhoneNumberService');
