/**
 * Checkout (`POST /orders`) error bodies over real HTTP.
 *
 * OrderExceptionFilter overrides the global filter on this route, so nothing
 * that tests AllExceptionsFilter says anything about checkout. What broke
 * here, and what each case pins:
 *
 * - the phone-verification error nested its flags one level too deep once
 *   throw sites moved to appError, so the app opened the modal in "verify"
 *   state for a user who has no phone number at all;
 * - the message was English whatever the app's language, with no top-level
 *   `code`;
 * - any status the filter did not name (403, 422, 429) became a 500.
 */

import {
  BadRequestException,
  Controller,
  ForbiddenException,
  INestApplication,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { appError } from '../../../common/errors/app-error';
import { AR } from '../../../common/errors/catalog/ar';
import { FR } from '../../../common/errors/catalog/fr';
import { AppLoggerService } from '../../../common/services/logger.service';
import { OrderExceptionFilter } from '../order-exception.filter';

@Controller('orders')
@UseFilters(OrderExceptionFilter)
class ProbeOrdersController {
  @Post('phone')
  phone(): never {
    throw new BadRequestException(
      appError('PHONE_VERIFICATION_REQUIRED', undefined, {
        requiresPhoneSetup: true,
        requiresPhoneVerification: false,
      }),
    );
  }

  @Post('forbidden')
  forbidden(): never {
    throw new ForbiddenException(appError('FORBIDDEN'));
  }

  @Post('boom')
  boom(): never {
    throw new Error('connection to db-internal-7 refused');
  }
}

const logger = {
  error: jest.fn(() => 'ERR-TEST-1'),
  warn: jest.fn(),
};

let app: INestApplication;
let base: string;

beforeAll(async () => {
  // Production: the filter reads NODE_ENV once, when Nest constructs it.
  const previous = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeOrdersController],
    providers: [OrderExceptionFilter, { provide: AppLoggerService, useValue: logger }],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0);
  process.env['NODE_ENV'] = previous;
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

const post = async (path: string, language: string) => {
  const res = await fetch(`${base}/orders/${path}`, {
    method: 'POST',
    headers: { 'Accept-Language': language },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe('OrderExceptionFilter', () => {
  it('sends the standard envelope: top-level code, message in the app language', async () => {
    const { status, body } = await post('phone', 'fr');

    expect(status).toBe(400);
    expect(body).toMatchObject({
      status: 400,
      code: 'PHONE_VERIFICATION_REQUIRED',
      message: FR.PHONE_VERIFICATION_REQUIRED,
    });
  });

  it('keeps code, message and the phone flags in `details`, where installed apps read them', async () => {
    const { body } = await post('phone', 'ar');

    // ordersService (mobile) throws `details` and reads the flags off it.
    expect(body['details']).toEqual({
      code: 'PHONE_VERIFICATION_REQUIRED',
      message: AR.PHONE_VERIFICATION_REQUIRED,
      requiresPhoneSetup: true,
      requiresPhoneVerification: false,
    });
    expect(body['statusCode']).toBe(400);
  });

  it('keeps the exception status (a 403 is not a 500)', async () => {
    const { status, body } = await post('forbidden', 'en');

    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN');
  });

  it('in production, a non-HTTP error is a 500 with an error id, no internal text and no details', async () => {
    const { status, body } = await post('boom', 'en');

    expect(status).toBe(500);
    expect(body['code']).toBe('INTERNAL_ERROR');
    expect(body['details']).toBeNull();
    expect(body['errorId']).toBe('ERR-TEST-1');
    expect(JSON.stringify(body)).not.toContain('db-internal-7');
  });
});
