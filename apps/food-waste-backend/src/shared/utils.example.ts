// Example of using shared package utilities in the backend
import {
  ValidationUtils,
  DateUtils,
  StringUtils,
  NumberUtils,
  CONSTANTS
} from '@foodwaste/shared';

/**
 * Example service showing integration between backend and shared package
 * This demonstrates that pnpm workspace dependencies work correctly
 */
export class SharedUtilsExample {
  /**
   * Validate user input using shared validation utilities
   */
  public static validateUserInput(email: string, password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!ValidationUtils.isEmail(email)) {
      errors.push('Invalid email format');
    }

    if (!ValidationUtils.isStrongPassword(password)) {
      errors.push('Password does not meet strength requirements');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format data for API responses using shared utilities
   */
  public static formatOfferData(offer: {
    title: string;
    price: number;
    createdAt: Date;
    expiresAt: Date;
  }): {
    id: string;
    title: string;
    formattedPrice: string;
    createdAt: string;
    expiresAt: string;
    isExpired: boolean;
    slug: string;
  } {
    return {
      id: StringUtils.generateId(12),
      title: StringUtils.capitalize(offer.title),
      formattedPrice: NumberUtils.formatCurrency(offer.price),
      createdAt: DateUtils.formatDateTime(offer.createdAt),
      expiresAt: DateUtils.formatDateTime(offer.expiresAt),
      isExpired: DateUtils.isExpired(offer.expiresAt),
      slug: StringUtils.slugify(offer.title),
    };
  }

  /**
   * Use shared constants for API endpoints
   */
  public static getApiEndpoints(): typeof CONSTANTS.API_ENDPOINTS {
    return CONSTANTS.API_ENDPOINTS;
  }

  /**
   * Sanitize user input before processing
   */
  public static sanitizeInput(input: string): string {
    return ValidationUtils.sanitizeString(input);
  }

  /**
   * Format currency amounts consistently across the application
   */
  public static formatPrice(amount: number, currency = CONSTANTS.CURRENCIES.TND): string {
    return NumberUtils.formatCurrency(amount, currency, 'ar-TN');
  }
}

// Example usage in a NestJS service:
/*
import { Injectable } from '@nestjs/common';
import { SharedUtilsExample } from './shared/utils.example';

@Injectable()
export class OfferService {
  formatOfferForResponse(offer: any) {
    return SharedUtilsExample.formatOfferData(offer);
  }

  validateOfferInput(title: string, price: string) {
    const sanitizedTitle = SharedUtilsExample.sanitizeInput(title);
    const numericPrice = parseFloat(price);

    return {
      title: sanitizedTitle,
      price: numericPrice,
      formattedPrice: SharedUtilsExample.formatPrice(numericPrice)
    };
  }
}
*/