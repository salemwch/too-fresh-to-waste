import { BadRequestException } from '@nestjs/common';
import { getMetadataStorage, type ValidationError } from 'class-validator';

import { isErrorCode, type ErrorCode, type ErrorParams } from './app-error';

/** One invalid field, as sent to the client. `message` is added by the filter. */
export interface FieldError {
  /** Dotted path, e.g. `address.city` or `items.0.quantity`. */
  field: string;
  code: ErrorCode;
  params?: ErrorParams;
}

/**
 * class-validator constraint name -> code. The DTO's own English message is
 * not used for the client: it was written once, in English, per DTO, and 240
 * of them would each need translating. The constraint says the same thing in a
 * form every language already has.
 *
 * A DTO that needs a more specific message sets a catalogue code as its
 * `message` (e.g. `@Matches(re, { message: 'PASSWORD_POLICY' })`), which wins.
 */
const CONSTRAINT_CODES: Readonly<Record<string, ErrorCode>> = {
  isNotEmpty: 'VALIDATION_REQUIRED',
  isDefined: 'VALIDATION_REQUIRED',
  arrayNotEmpty: 'VALIDATION_REQUIRED',
  isEmail: 'VALIDATION_EMAIL',
  minLength: 'VALIDATION_MIN_LENGTH',
  maxLength: 'VALIDATION_MAX_LENGTH',
  isLength: 'VALIDATION_LENGTH',
  min: 'VALIDATION_MIN',
  max: 'VALIDATION_MAX',
  isNumber: 'VALIDATION_NUMBER',
  isNumberString: 'VALIDATION_NUMBER',
  isDecimal: 'VALIDATION_NUMBER',
  isInt: 'VALIDATION_INTEGER',
  isPositive: 'VALIDATION_POSITIVE',
  isBoolean: 'VALIDATION_BOOLEAN',
  isBooleanString: 'VALIDATION_BOOLEAN',
  isDate: 'VALIDATION_DATE',
  isDateString: 'VALIDATION_DATE',
  isISO8601: 'VALIDATION_DATE',
  isEnum: 'VALIDATION_ENUM',
  isIn: 'VALIDATION_ENUM',
  matches: 'VALIDATION_FORMAT',
  isPhoneNumber: 'VALIDATION_PHONE',
  isMobilePhone: 'VALIDATION_PHONE',
  isUrl: 'VALIDATION_URL',
  isMongoId: 'VALIDATION_ID',
  isUUID: 'VALIDATION_ID',
  isString: 'VALIDATION_TEXT',
  isArray: 'VALIDATION_LIST',
  arrayMinSize: 'VALIDATION_LIST_MIN',
  arrayMaxSize: 'VALIDATION_LIST_MAX',
  isLatitude: 'VALIDATION_COORDINATE',
  isLongitude: 'VALIDATION_COORDINATE',
  isLatLong: 'VALIDATION_COORDINATE',
  whitelistValidation: 'VALIDATION_NOT_ALLOWED',
};

/** Which constraint arguments a code's placeholders read. */
const PARAM_NAMES: Readonly<Partial<Record<ErrorCode, readonly string[]>>> = {
  VALIDATION_MIN_LENGTH: ['min'],
  VALIDATION_MAX_LENGTH: ['max'],
  VALIDATION_LENGTH: ['min', 'max'],
  VALIDATION_MIN: ['min'],
  VALIDATION_MAX: ['max'],
  VALIDATION_LIST_MIN: ['min'],
  VALIDATION_LIST_MAX: ['max'],
};

/** The arguments the decorator was declared with, e.g. `[12]` for `@MinLength(12)`. */
function constraintArgs(error: ValidationError, constraint: string): unknown[] {
  const target = error.target?.constructor;
  if (!target) {
    return [];
  }
  const metadata = getMetadataStorage()
    .getTargetValidationMetadatas(target, '', true, false)
    .find(m => m.propertyName === error.property && m.name === constraint);
  return metadata?.constraints ?? [];
}

function paramsFor(code: ErrorCode, args: unknown[]): ErrorParams | undefined {
  const names = PARAM_NAMES[code];
  if (!names) {
    return undefined;
  }
  const params: Record<string, string | number> = {};
  names.forEach((name, i) => {
    const value = args[i];
    if (typeof value === 'number' || typeof value === 'string') {
      params[name] = value;
    }
  });
  return Object.keys(params).length > 0 ? params : undefined;
}

/** Every failing constraint, children included, as a flat list. */
export function toFieldErrors(errors: readonly ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap(error => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => {
      const code: ErrorCode = isErrorCode(message)
        ? message
        : (CONSTRAINT_CODES[constraint] ?? 'VALIDATION_INVALID');
      const params = isErrorCode(message)
        ? undefined
        : paramsFor(code, constraintArgs(error, constraint));
      return { field, code, ...(params ? { params } : {}) };
    });
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

/**
 * The ValidationPipe `exceptionFactory`. Keeps the English detail in `message`
 * for logs and for code that reads it, and hands the filter a field list it
 * can translate.
 */
export function validationException(errors: readonly ValidationError[]): BadRequestException {
  const fields = toFieldErrors(errors);
  const detail = errors
    .flatMap(function messages(e): string[] {
      return [...Object.values(e.constraints ?? {}), ...(e.children ?? []).flatMap(messages)];
    })
    .join('; ');
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: `Validation failed: ${detail}`,
    errors: fields,
  });
}
