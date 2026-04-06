import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Production-Grade Business Logic Validators
 *
 * These validators enforce domain-specific rules that go beyond simple type checking.
 * They address the audit finding: "DTOs don't validate business logic"
 *
 * Pattern: Custom constraint classes + decorator factories
 * Reference: https://github.com/typestack/class-validator#custom-validation-classes
 */

function getFirstNumberConstraint(args: ValidationArguments): number | undefined {
  const [constraint] = args.constraints as unknown[];
  return typeof constraint === 'number' ? constraint : undefined;
}

function getTwoNumberConstraints(
  args: ValidationArguments,
): { first: number; second: number } | undefined {
  const [firstConstraint, secondConstraint] = args.constraints as unknown[];

  if (typeof firstConstraint !== 'number' || typeof secondConstraint !== 'number') {
    return undefined;
  }

  return { first: firstConstraint, second: secondConstraint };
}

function getFirstStringConstraint(args: ValidationArguments): string | undefined {
  const [constraint] = args.constraints as unknown[];
  return typeof constraint === 'string' ? constraint : undefined;
}

// ==================== DATE/TIME VALIDATORS ====================

/**
 * Validates that a date is in the future (beyond current time + optional buffer)
 *
 * Use cases:
 * - Booking/reservation times
 * - Event scheduling
 * - Expiration dates
 *
 * @param minMinutesFromNow - Minimum minutes from current time (default: 0)
 * @param validationOptions - Standard class-validator options
 *
 * @example
 * ```typescript
 * class CreateOrderDto {
 *   @IsFutureDate(30) // Must be at least 30 minutes from now
 *   @IsDate()
 *   pickupTime: Date;
 * }
 * ```
 */
export function IsFutureDate(
  minMinutesFromNow: number = 0,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [minMinutesFromNow],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!(value instanceof Date) && typeof value !== 'string') {
            return false;
          }

          const date = value instanceof Date ? value : new Date(value);

          if (isNaN(date.getTime())) {
            return false;
          }

          const minMinutes = getFirstNumberConstraint(args);
          if (minMinutes === undefined) {
            return false;
          }

          const minTime = new Date();
          minTime.setMinutes(minTime.getMinutes() + minMinutes);

          return date.getTime() > minTime.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          const minMinutes = getFirstNumberConstraint(args);
          if (minMinutes === undefined) {
            return `${args.property} must be a future date`;
          }

          if (minMinutes > 0) {
            return `${args.property} must be at least ${minMinutes} minutes in the future`;
          }
          return `${args.property} must be a future date`;
        },
      },
    });
  };
}

/**
 * Validates that a date falls within business hours
 *
 * @param startHour - Business day start (24h format, e.g., 9)
 * @param endHour - Business day end (24h format, e.g., 17)
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class CreateAppointmentDto {
 *   @IsBusinessHours(9, 17) // 9 AM to 5 PM
 *   @IsDate()
 *   appointmentTime: Date;
 * }
 * ```
 */
export function IsBusinessHours(
  startHour: number = 9,
  endHour: number = 17,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isBusinessHours',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [startHour, endHour],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!(value instanceof Date) && typeof value !== 'string') {
            return false;
          }

          const date = value instanceof Date ? value : new Date(value);
          if (isNaN(date.getTime())) {
            return false;
          }

          const range = getTwoNumberConstraints(args);
          if (range === undefined) {
            return false;
          }

          const { first: start, second: end } = range;
          const hour = date.getHours();

          return hour >= start && hour < end;
        },
        defaultMessage(args: ValidationArguments) {
          const range = getTwoNumberConstraints(args);
          if (range === undefined) {
            return `${args.property} must fall within business hours`;
          }

          const { first: start, second: end } = range;
          return `${args.property} must be between ${start}:00 and ${end}:00`;
        },
      },
    });
  };
}

/**
 * Validates that a date is within a specific range from now
 *
 * @param maxDaysFromNow - Maximum days in the future
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class BookReservationDto {
 *   @IsWithinDays(30) // Cannot book more than 30 days ahead
 *   @IsFutureDate()
 *   reservationDate: Date;
 * }
 * ```
 */
export function IsWithinDays(
  maxDaysFromNow: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isWithinDays',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [maxDaysFromNow],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!(value instanceof Date) && typeof value !== 'string') {
            return false;
          }

          const date = value instanceof Date ? value : new Date(value);
          if (isNaN(date.getTime())) {
            return false;
          }

          const maxDays = getFirstNumberConstraint(args);
          if (maxDays === undefined) {
            return false;
          }

          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + maxDays);

          return date.getTime() <= maxDate.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          const maxDays = getFirstNumberConstraint(args);
          if (maxDays === undefined) {
            return `${args.property} must be within the allowed date range`;
          }

          return `${args.property} cannot be more than ${maxDays} days in the future`;
        },
      },
    });
  };
}

// ==================== NUMERIC/QUANTITY VALIDATORS ====================

/**
 * Validates minimum quantity/amount with custom business rules
 *
 * @param min - Minimum allowed value
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class CreateOrderDto {
 *   @IsMinQuantity(1)
 *   @IsNumber()
 *   quantity: number;
 * }
 * ```
 */
export function IsMinQuantity(
  min: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isMinQuantity',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [min],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'number') {
            return false;
          }

          const minValue = getFirstNumberConstraint(args);
          if (minValue === undefined) {
            return false;
          }

          return value >= minValue && Number.isInteger(value);
        },
        defaultMessage(args: ValidationArguments) {
          const minValue = getFirstNumberConstraint(args);
          if (minValue === undefined) {
            return `${args.property} must be a valid quantity`;
          }

          return `${args.property} must be an integer >= ${minValue}`;
        },
      },
    });
  };
}

/**
 * Validates that a price is a valid monetary amount (2 decimal places max)
 *
 * @param minPrice - Minimum allowed price (default: 0.01)
 * @param maxPrice - Maximum allowed price (default: 1,000,000)
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class CreateOfferDto {
 *   @IsValidPrice(0.50, 10000)
 *   @IsNumber()
 *   price: number;
 * }
 * ```
 */
export function IsValidPrice(
  minPrice: number = 0.01,
  maxPrice: number = 1_000_000,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isValidPrice',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [minPrice, maxPrice],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'number' || isNaN(value)) {
            return false;
          }

          const range = getTwoNumberConstraints(args);
          if (range === undefined) {
            return false;
          }

          const { first: min, second: max } = range;

          // Check range
          if (value < min || value > max) {
            return false;
          }

          // Check decimal places (max 2 for currency)
          const decimalPlaces = (value.toString().split('.')[1] ?? '').length;
          return decimalPlaces <= 2;
        },
        defaultMessage(args: ValidationArguments) {
          const range = getTwoNumberConstraints(args);
          if (range === undefined) {
            return `${args.property} must be a valid price`;
          }

          const { first: min, second: max } = range;
          return `${args.property} must be between ${min} and ${max} with max 2 decimal places`;
        },
      },
    });
  };
}

// ==================== STRING PATTERN VALIDATORS ====================

/**
 * Validates that a string doesn't contain profanity or banned words
 * Injectable constraint for dependency injection support
 */
@ValidatorConstraint({ name: 'isNotProfane', async: false })
@Injectable()
export class IsNotProfaneConstraint implements ValidatorConstraintInterface {
  // In production, load from database or external service
  private readonly bannedWords = new Set([
    // Add profanity list here
    // This is just a placeholder - use a proper profanity filter library
    'spam',
    'scam',
    'fraud',
  ]);

  validate(text: string, _args: ValidationArguments): boolean {
    if (!text || typeof text !== 'string') {
      return true; // Let @IsString handle type validation
    }

    const lowerText = text.toLowerCase();
    return !Array.from(this.bannedWords).some((word) => lowerText.includes(word));
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains inappropriate content`;
  }
}

/**
 * Decorator to use IsNotProfaneConstraint
 *
 * @example
 * ```typescript
 * class CreateReviewDto {
 *   @IsNotProfane()
 *   @IsString()
 *   @MaxLength(500)
 *   comment: string;
 * }
 * ```
 */
export function IsNotProfane(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [],
      validator: IsNotProfaneConstraint,
    });
  };
}

// ==================== CROSS-FIELD VALIDATORS ====================

/**
 * Validates that one field is greater than another
 *
 * @param relatedPropertyName - Name of the field to compare against
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class CreateOfferDto {
 *   @IsNumber()
 *   originalPrice: number;
 *
 *   @IsGreaterThanField('originalPrice')
 *   @IsNumber()
 *   discountedPrice: number;
 * }
 * ```
 */
export function IsGreaterThanField(
  relatedPropertyName: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isGreaterThanField',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [relatedPropertyName],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const relatedProp = getFirstStringConstraint(args);
          if (relatedProp === undefined) {
            return false;
          }

          const relatedValue = (args.object as Record<string, unknown>)[relatedProp];

          if (typeof value !== 'number' || typeof relatedValue !== 'number') {
            return false;
          }

          return value > relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const relatedProp = getFirstStringConstraint(args);
          if (relatedProp === undefined) {
            return `${args.property} must be greater than the related field`;
          }

          return `${args.property} must be greater than ${relatedProp}`;
        },
      },
    });
  };
}

/**
 * Validates that one field is less than another
 *
 * @param relatedPropertyName - Name of the field to compare against
 * @param validationOptions
 *
 * @example
 * ```typescript
 * class CreateOfferDto {
 *   @IsNumber()
 *   originalPrice: number;
 *
 *   @IsLessThanField('originalPrice')
 *   @IsValidPrice()
 *   discountedPrice: number;
 * }
 * ```
 */
export function IsLessThanField(
  relatedPropertyName: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isLessThanField',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      constraints: [relatedPropertyName],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const relatedProp = getFirstStringConstraint(args);
          if (relatedProp === undefined) {
            return false;
          }

          const relatedValue = (args.object as Record<string, unknown>)[relatedProp];

          if (typeof value !== 'number' || typeof relatedValue !== 'number') {
            return false;
          }

          return value < relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const relatedProp = getFirstStringConstraint(args);
          if (relatedProp === undefined) {
            return `${args.property} must be less than the related field`;
          }

          return `${args.property} must be less than ${relatedProp}`;
        },
      },
    });
  };
}

// ==================== GEO/LOCATION VALIDATORS ====================

/**
 * Validates latitude coordinates (-90 to 90)
 *
 * @example
 * ```typescript
 * class CreateLocationDto {
 *   @IsLatitude()
 *   @IsNumber()
 *   latitude: number;
 * }
 * ```
 */
export function IsLatitude(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isLatitude',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      validator: {
        validate(value: unknown) {
          return typeof value === 'number' && value >= -90 && value <= 90;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid latitude (-90 to 90)`;
        },
      },
    });
  };
}

/**
 * Validates longitude coordinates (-180 to 180)
 *
 * @example
 * ```typescript
 * class CreateLocationDto {
 *   @IsLongitude()
 *   @IsNumber()
 *   longitude: number;
 * }
 * ```
 */
export function IsLongitude(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isLongitude',
      target: object.constructor,
      propertyName: String(propertyName),
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      validator: {
        validate(value: unknown) {
          return typeof value === 'number' && value >= -180 && value <= 180;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid longitude (-180 to 180)`;
        },
      },
    });
  };
}
