import { HttpException, HttpStatus } from '@nestjs/common';

import { appError, type ErrorCode } from './app-error';

/**
 * For a `catch` that must turn any failure into an HTTP error:
 *
 *   } catch (error) {
 *     throw toHttpException(error, 'PROFILE_UPDATE_FAILED');
 *   }
 *
 * An HttpException passes through untouched, keeping its status and code - a
 * 404 thrown inside stays a 404. Anything else becomes the fallback code, as a
 * 500 by default. The original `error.message` is never forwarded: it is
 * written for developers, can carry internal detail, and is always English.
 */
export function toHttpException(
  error: unknown,
  fallback: ErrorCode,
  status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
  return new HttpException(appError(fallback), status, { cause: error });
}
