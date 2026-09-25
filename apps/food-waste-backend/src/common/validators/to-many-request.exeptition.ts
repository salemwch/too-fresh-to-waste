import { HttpException, HttpStatus } from '@nestjs/common';

import type { AppErrorBody } from '../errors';

/** 429, accepting a coded body like Nest's built-in exceptions do. */
export class TooManyRequestsException extends HttpException {
  constructor(message: string | AppErrorBody = 'Too Many Requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
