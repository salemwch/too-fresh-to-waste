import { ValidationPipe } from '@nestjs/common';

import { validationException } from './validation-errors';

/**
 * The application's global ValidationPipe, in one place so main.ts and the
 * HTTP-level tests run the same configuration.
 *
 * Invalid input becomes coded field errors that the exception filter
 * translates per request; the English detail stays on the exception message,
 * which `onInvalid` receives for logging.
 */
export function createAppValidationPipe(onInvalid?: (detail: string) => void): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: errors => {
      const exception = validationException(errors);
      onInvalid?.(exception.message);
      return exception;
    },
  });
}
