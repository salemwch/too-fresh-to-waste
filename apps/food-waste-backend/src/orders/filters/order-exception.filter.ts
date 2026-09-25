import {
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Catch } from '@nestjs/common';

import { resolveErrorLocale } from '../../common/errors/app-error';
import { toClientError } from '../../common/errors/client-error';
import { AppLoggerService } from '../../common/services/logger.service';

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

/**
 * Errors from `POST /orders` (checkout).
 *
 * The body is the standard envelope every other endpoint returns - a stable
 * `code`, `message` in the requester's language, `errors`/`details` when
 * relevant - so new clients read checkout errors the way they read any other.
 *
 * It additionally keeps the two fields app versions already installed read:
 * `statusCode`, and a `details` object that repeats `code` and `message` next
 * to the client-safe extras. Those versions look for the code and the phone
 * flags there (`details.code`, `details.requiresPhoneSetup`); without them the
 * phone-verification modal opens in the wrong state. Drop them once no
 * supported app version reads `details.code`.
 *
 * It used to map every status it did not name to 500, so a 403 at checkout
 * reached the app as a server error, and it sent English whatever the app's
 * language. The status is now the exception's own.
 */
@Catch()
export class OrderExceptionFilter implements ExceptionFilter {
  private readonly isProduction = process.env['NODE_ENV'] === 'production';

  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const request = ctx.getRequest<ExpressRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawMessage = exception instanceof Error ? exception.message : 'Unknown error';

    const client = toClientError({
      body: exception instanceof HttpException ? exception.getResponse() : undefined,
      rawMessage,
      status,
      locale: resolveErrorLocale(request.headers['accept-language']),
      isProduction: this.isProduction,
    });

    let errorId: string | undefined;
    if (status >= 500) {
      errorId = this.logger.error(
        `Order error: ${rawMessage}`,
        exception instanceof Error ? exception : undefined,
        'OrderExceptionFilter',
      );
    } else {
      this.logger.warn(
        `Order rejected (${status} ${client.code}): ${rawMessage}`,
        'OrderExceptionFilter',
      );
    }

    response.status(status).json({
      status,
      code: client.code,
      message: client.message,
      ...(client.params ? { params: client.params } : {}),
      ...(client.errors ? { errors: client.errors } : {}),
      // Legacy shape for installed app versions - see the class comment.
      statusCode: status,
      details:
        status < 500
          ? { ...(client.details ?? {}), code: client.code, message: client.message }
          : null,
      ...(errorId ? { errorId } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
