/**
 * Phone Validator Service for SMS Notifications
 *
 * This service provides phone number validation for the SMS notification module.
 * It now uses PhoneNumberService (libphonenumber-js) for production-grade validation.
 *
 * @deprecated Individual methods are deprecated in favor of PhoneNumberService
 * This wrapper is maintained for backward compatibility with existing SMS code
 */

import { Injectable } from '@nestjs/common';
import { CountryCode } from 'libphonenumber-js';

import { PhoneNumberService } from '../../common/services/phone-number.service';
import { PhoneValidationResult } from '../interfaces/sms.interfaces';

@Injectable()
export class PhoneValidatorService {
  constructor(private readonly phoneNumberService: PhoneNumberService) {}

  /**
   * Validates phone number using libphonenumber-js
   * @deprecated Use PhoneNumberService.validatePhoneNumber() directly
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    const result = this.phoneNumberService.validatePhoneNumber(phoneNumber);
    return result.isValid;
  }

  /**
   * Formats phone number to E.164 format using libphonenumber-js
   * @deprecated Use PhoneNumberService.normalizePhoneNumber() directly
   */
  formatPhoneNumber(phoneNumber: string, countryCode: string = 'TN'): string {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Invalid phone number provided');
    }

    // Use PhoneNumberService for robust formatting
    const normalized = this.phoneNumberService.normalizePhoneNumber(
      phoneNumber,
      countryCode as CountryCode | undefined,
    );

    if (normalized) {
      return normalized;
    }

    // Fallback: return as-is if normalization fails
    return phoneNumber;
  }

  /**
   * Validates and formats phone number with full details
   * Now uses libphonenumber-js for production-grade validation
   */
  validateAndFormat(phoneNumber: string, countryCode?: string): PhoneValidationResult {
    try {
      if (!phoneNumber) {
        return {
          isValid: false,
          errorMessage: 'Phone number is required',
        };
      }

      // Use PhoneNumberService for validation
      const validation = this.phoneNumberService.validatePhoneNumber(
        phoneNumber,
        countryCode as CountryCode | undefined,
      );

      if (!validation.isValid) {
        return {
          isValid: false,
          errorMessage: validation.error ?? 'Invalid phone number format',
        };
      }

      return {
        isValid: true,
        formatted: validation.details?.formatted.e164,
        country: validation.details?.country,
        errorMessage: undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: (error as Error).message,
      };
    }
  }

  /**
   * Sanitizes phone number by removing all non-digit characters except +
   * @deprecated Use PhoneNumberService methods instead
   */
  sanitizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) {
      return '';
    }
    // Remove everything except digits and + sign
    return phoneNumber.replace(/[^\d+]/g, '');
  }

  /**
   * Masks phone number for secure logging
   * Shows only last 4 digits
   * This method is NOT deprecated as it's a security utility
   */
  maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '****';
    }

    // Show only last 4 digits
    const lastFour = phoneNumber.slice(-4);
    const masked = '*'.repeat(phoneNumber.length - 4);
    return masked + lastFour;
  }
}
