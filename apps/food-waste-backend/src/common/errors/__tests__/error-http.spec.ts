/**
 * Error responses over real HTTP - the production exception filter and
 * validation pipe, a real Nest app on a random port, requests sent with the
 * header clients actually send. What a user of the app receives, end to end.
 *
 * No database and no new dependency: Node's own `fetch` against `listen(0)`.
 */

import {
  Body,
  Controller,
  Get,
  INestApplication,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, MinLength } from 'class-validator';

import { AllExceptionsFilter } from '../../filters/all-exceptions.filter';
import { appError } from '../app-error';
import { AR } from '../catalog/ar';
import { EN } from '../catalog/en';
import { FR } from '../catalog/fr';
import { createAppValidationPipe } from '../validation-pipe';

class SignUpDto {
  @IsEmail()
  email!: string;

  @MinLength(12)
  password!: string;
}

@Controller('probe')
class ProbeController {
  @Get('coded')
  coded(): never {
    throw new NotFoundException(appError('ORDER_NOT_FOUND'));
  }

  @Get('params')
  params(): never {
    throw new NotFoundException(appError('DATE_RANGE_TOO_LONG', { maxDays: 90 }));
  }

  @Get('locked')
  locked(): never {
    throw new UnauthorizedException(
      appError('ACCOUNT_LOCKED', undefined, {
        type: 'ACCOUNT_LOCKED',
        blockedUntil: '2026-09-25T12:00:00.000Z',
      }),
    );
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection to db-internal-7 refused');
  }

  @Post('signup')
  signup(@Body() dto: SignUpDto): SignUpDto {
    return dto;
  }
}

const start = async (production: boolean): Promise<{ app: INestApplication; base: string }> => {
  const previous = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = production ? 'production' : 'test';
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalFilters(new AllExceptionsFilter()); // reads NODE_ENV once, here
  app.useGlobalPipes(createAppValidationPipe());
  await app.listen(0);
  process.env['NODE_ENV'] = previous;
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  return { app, base };
};

const call = async (
  base: string,
  path: string,
  lang?: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> => {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(lang ? { 'Accept-Language': lang } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
};

describe('error responses over HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    ({ app, base } = await start(false));
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['fr-TN,fr;q=0.9', FR.ORDER_NOT_FOUND],
    ['ar', AR.ORDER_NOT_FOUND],
    ['en-GB', EN.ORDER_NOT_FOUND],
    [undefined, EN.ORDER_NOT_FOUND],
  ])('answers Accept-Language %s in that language, with the code', async (lang, message) => {
    const { status, json } = await call(base, '/probe/coded', lang);

    expect(status).toBe(404);
    expect(json).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND', message });
  });

  it('fills placeholders in the translated message', async () => {
    const { json } = await call(base, '/probe/params', 'fr');
    expect(json['message']).toContain('90');
    expect(json['params']).toEqual({ maxDays: 90 });
  });

  it('delivers the lockout details the app needs', async () => {
    const { status, json } = await call(base, '/probe/locked', 'ar');

    expect(status).toBe(401);
    expect(json).toMatchObject({
      code: 'ACCOUNT_LOCKED',
      message: AR.ACCOUNT_LOCKED,
      details: { type: 'ACCOUNT_LOCKED', blockedUntil: '2026-09-25T12:00:00.000Z' },
    });
  });

  it('translates validation errors field by field, with the declared limits', async () => {
    const { status, json } = await call(base, '/probe/signup', 'fr', {
      email: 'not-an-email',
      password: 'short',
    });

    expect(status).toBe(400);
    expect(json['code']).toBe('VALIDATION_FAILED');
    expect(json['errors']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          code: 'VALIDATION_EMAIL',
          message: FR.VALIDATION_EMAIL,
        }),
        expect.objectContaining({
          field: 'password',
          code: 'VALIDATION_MIN_LENGTH',
          params: { min: 12 },
        }),
      ]),
    );
  });

  it('rejects an unknown field, in the requested language', async () => {
    const { json } = await call(base, '/probe/signup', 'ar', {
      email: 'a@b.tn',
      password: 'Abcdefghij1!',
      role: 'admin',
    });
    expect(json).toMatchObject({ code: 'VALIDATION_FAILED', message: AR.VALIDATION_NOT_ALLOWED });
  });

  it('gives an unknown route a code and a translated message', async () => {
    const { status, json } = await call(base, '/probe/nope', 'fr');
    expect(status).toBe(404);
    expect(json).toMatchObject({ code: 'ROUTE_NOT_FOUND', message: FR.ROUTE_NOT_FOUND });
  });
});

describe('error responses over HTTP, in production', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    ({ app, base } = await start(true));
  });

  afterAll(async () => {
    await app.close();
  });

  it('never sends an internal error message to the client', async () => {
    const { status, json } = await call(base, '/probe/boom', 'fr');

    expect(status).toBe(500);
    expect(json['code']).toBe('INTERNAL_ERROR');
    expect(json['message']).toBe(FR.INTERNAL_ERROR_WITH_ID);
    expect(JSON.stringify(json)).not.toContain('db-internal-7');
    expect(json['errorId']).toEqual(expect.any(String));
  });
});
