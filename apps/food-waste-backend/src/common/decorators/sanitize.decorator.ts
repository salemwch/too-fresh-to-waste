import { Logger } from '@nestjs/common';
import { Transform } from 'class-transformer';

import type { TransformFnParams } from 'class-transformer';

/**
 * CRITICAL: Sanitization decorators that execute BEFORE validation
 *
 * @Transform runs in class-transformer pipeline BEFORE class-validator decorators.
 * This prevents XSS payloads from bypassing validation rules.
 *
 * Security Rationale:
 * - Attackers can craft payloads like `<script>alert('xss')</script>test@example.com`
 * - If validation runs first, @IsEmail might fail but error message could leak the script
 * - By sanitizing first, we guarantee clean input reaches validators
 *
 * Reference: OWASP Input Validation Cheat Sheet
 * https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 */

const logger = new Logger('SanitizeDecorators');

function getTransformValue(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return value;
}

/**
 * Sanitize text input by encoding HTML entities and removing control characters
 * Use for: names, addresses, general text fields
 *
 * @example
 * ```typescript
 * class CreateUserDto {
 *   @SanitizeText()
 *   @IsString()
 *   @MinLength(2)
 *   firstName: string;
 * }
 * ```
 */
export function SanitizeText(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      return (
        value
          // HTML entity encoding (defense in depth)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;')
          // Remove control characters (U+0000 to U+001F except tab, newline, carriage return)
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          // Normalize whitespace
          .replace(/\s+/g, ' ')
          .trim()
      );
    },
    { toClassOnly: true },
  ); // Only apply when transforming plain object to class
}

/**
 * Aggressive HTML sanitization - removes ALL tags and attributes
 * Use for: descriptions, comments, user-generated content
 *
 * IMPORTANT: For production, replace with `sanitize-html` npm package
 * Current implementation is a stopgap measure
 *
 * @example
 * ```typescript
 * class CreatePostDto {
 *   @SanitizeHtml()
 *   @IsString()
 *   @MaxLength(5000)
 *   content: string;
 * }
 * ```
 */
export function SanitizeHtml(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      let sanitized = value;

      // Remove script tags and content
      sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');

      // Remove dangerous tags
      const dangerousTags = [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'textarea',
        'select',
        'option',
        'link',
        'meta',
        'style',
        'title',
        'base',
        'head',
        'html',
        'body',
        'applet',
        'bgsound',
        'blink',
        'marquee',
        'xml',
        'svg',
        'math',
      ];

      dangerousTags.forEach((tag) => {
        const regex = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
        sanitized = sanitized.replace(regex, '');
      });

      // Remove ALL event handlers
      sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
      sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

      // Remove dangerous protocols
      sanitized = sanitized
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:text\/html/gi, '')
        .replace(/data:text\/javascript/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/@import/gi, '');

      // Remove remaining HTML tags (conservative approach)
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Decode common HTML entities to prevent double-encoding
      sanitized = sanitized
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&amp;/g, '&');

      // Re-encode for safety
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

      return sanitized.trim();
    },
    { toClassOnly: true },
  );
}

/**
 * Normalize email: lowercase, trim, remove invalid characters
 * Use for: email fields only
 *
 * @example
 * ```typescript
 * class LoginDto {
 *   @SanitizeEmail()
 *   @IsEmail()
 *   email: string;
 * }
 * ```
 */
export function SanitizeEmail(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      return (
        value
          .toLowerCase()
          .trim()
          // Remove any characters that aren't valid in email addresses
          .replace(/[^\w\s@.\-+]/gi, '')
          // Remove multiple dots
          .replace(/\.{2,}/g, '.')
          // Remove whitespace
          .replace(/\s/g, '')
      );
    },
    { toClassOnly: true },
  );
}

/**
 * Normalize phone number: remove all non-digit characters except +
 * Use for: phone number fields
 *
 * @example
 * ```typescript
 * class RegisterDto {
 *   @SanitizePhoneNumber()
 *   @IsValidPhoneNumber()
 *   phoneNumber: string;
 * }
 * ```
 */
export function SanitizePhoneNumber(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      // Keep only digits, +, spaces, hyphens, parentheses (libphonenumber handles these)
      return value.trim().replace(/[^\d\s\-+()]/g, '');
    },
    { toClassOnly: true },
  );
}

/**
 * Sanitize URL: validate protocol and remove dangerous patterns
 * Use for: URL fields, redirects, image sources
 *
 * @example
 * ```typescript
 * class UpdateProfileDto {
 *   @SanitizeUrl()
 *   @IsUrl()
 *   @IsOptional()
 *   website?: string;
 * }
 * ```
 */
export function SanitizeUrl(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      let sanitized = value.trim();

      // Remove dangerous protocols
      sanitized = sanitized
        .replace(/^javascript:/gi, '')
        .replace(/^vbscript:/gi, '')
        .replace(/^data:text\/html/gi, '')
        .replace(/^data:text\/javascript/gi, '');

      // Validate protocol if present
      try {
        const parsed = new URL(sanitized);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          logger.warn(`Blocked dangerous URL protocol: ${parsed.protocol}`);
          return '';
        }
        return sanitized;
      } catch {
        // Not a valid URL - might be relative path
        if (
          sanitized.startsWith('/') ||
          sanitized.startsWith('./') ||
          sanitized.startsWith('../')
        ) {
          // Remove any dangerous characters from path
          return sanitized.replace(/[<>"'`]/g, '');
        }
        logger.warn(`Invalid URL format rejected: ${sanitized.substring(0, 50)}`);
        return '';
      }
    },
    { toClassOnly: true },
  );
}

/**
 * Sanitize numeric string input - remove non-digit characters
 * Use for: numeric codes, IDs that come as strings
 *
 * @example
 * ```typescript
 * class VerifyCodeDto {
 *   @SanitizeNumeric()
 *   @IsString()
 *   @Length(6, 6)
 *   code: string;
 * }
 * ```
 */
export function SanitizeNumeric(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || value === '') {
        return value;
      }

      if (typeof value === 'number') {
        return value.toString();
      }

      if (typeof value === 'string') {
        return value.replace(/\D/g, '');
      }

      return value;
    },
    { toClassOnly: true },
  );
}

/**
 * Sanitize MongoDB ObjectId - ensure it's a valid 24-char hex string
 * Use for: entity IDs, references
 *
 * @example
 * ```typescript
 * class UpdateOrderDto {
 *   @SanitizeObjectId()
 *   @IsMongoId()
 *   customerId: string;
 * }
 * ```
 */
export function SanitizeObjectId(): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || typeof value !== 'string') {
        return value;
      }

      // Remove any non-hex characters
      const sanitized = value.trim().replace(/[^a-f0-9]/gi, '');

      // Ensure it's 24 characters (MongoDB ObjectId length)
      if (sanitized.length !== 24) {
        logger.warn(`Invalid ObjectId length: ${sanitized.length}`);
        return value; // Let validator handle the error
      }

      return sanitized.toLowerCase();
    },
    { toClassOnly: true },
  );
}

/**
 * Sanitize enum value - whitelist specific values
 * Use for: enum fields to prevent injection of unexpected values
 *
 * @param allowedValues - Array of allowed enum values
 *
 * @example
 * ```typescript
 * class UpdateOrderDto {
 *   @SanitizeEnum([OrderStatus.PENDING, OrderStatus.CONFIRMED])
 *   @IsEnum(OrderStatus)
 *   status: OrderStatus;
 * }
 * ```
 */
export function SanitizeEnum<T>(allowedValues: T[]): PropertyDecorator {
  return Transform(
    (params: TransformFnParams) => {
      const value = getTransformValue(params);

      if (value === null || value === undefined || value === '') {
        return value;
      }

      const stringValue = String(value).toLowerCase().trim();
      const allowed = allowedValues.map((v) => String(v).toLowerCase());

      if (!allowed.includes(stringValue)) {
        logger.warn(`Rejected invalid enum value: ${stringValue}`);
        return undefined; // Let validator handle
      }

      // Return original cased value from allowedValues
      const index = allowed.indexOf(stringValue);
      return allowedValues[index];
    },
    { toClassOnly: true },
  );
}
