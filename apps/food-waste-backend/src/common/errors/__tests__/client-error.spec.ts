/**
 * toClientError - what a client receives for an exception, and in which language.
 */

import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, MinLength, validate } from 'class-validator';

import { appError, resolveErrorLocale } from '../app-error';
import { AR } from '../catalog/ar';
import { EN } from '../catalog/en';
import { FR } from '../catalog/fr';
import { toClientError } from '../client-error';
import { validationException } from '../validation-errors';

const run = (
  exception: { getResponse(): unknown; getStatus(): number; message: string },
  locale: 'en' | 'fr' | 'ar' = 'en',
  isProduction = false,
) =>
  toClientError({
    body: exception.getResponse(),
    rawMessage: exception.message,
    status: exception.getStatus(),
    locale,
    isProduction,
  });

describe('resolveErrorLocale', () => {
  it.each([
    ['ar', 'ar'],
    ['ar-TN', 'ar'],
    ['fr-TN,fr;q=0.9,en;q=0.8', 'fr'],
    ['FR', 'fr'],
    ['en-GB', 'en'],
    ['de-DE,fr;q=0.5', 'fr'],
    ['de-DE', 'en'],
    ['*', 'en'],
    ['', 'en'],
    [undefined, 'en'],
    [['fr', 'en'], 'fr'],
  ])('%j -> %s', (header, expected) => {
    expect(resolveErrorLocale(header as string | string[] | undefined)).toBe(expected);
  });
});

describe('toClientError', () => {
  it('translates a coded error into the requested language', () => {
    const e = new NotFoundException(appError('ORDER_NOT_FOUND'));

    expect(run(e, 'fr')).toMatchObject({ code: 'ORDER_NOT_FOUND', message: FR.ORDER_NOT_FOUND });
    expect(run(e, 'ar').message).toBe(AR.ORDER_NOT_FOUND);
  });

  it('keeps the English message inside the backend, for logs and listeners', () => {
    const e = new NotFoundException(appError('LOYALTY_ACCOUNT_NOT_FOUND'));
    expect(e.message).toBe(EN.LOYALTY_ACCOUNT_NOT_FOUND);
  });

  it('fills placeholders in every language', () => {
    const e = new BadRequestException(appError('DATE_RANGE_TOO_LONG', { maxDays: 90 }));

    expect(run(e, 'fr')).toMatchObject({
      message: expect.stringContaining('90'),
      params: { maxDays: 90 },
    });
    expect(run(e, 'fr').message).not.toContain('{');
  });

  it('recognises a code thrown as the message (the voting convention)', () => {
    expect(run(new BadRequestException('BALLOT_NOT_OPEN'), 'fr')).toMatchObject({
      code: 'BALLOT_NOT_OPEN',
      message: FR.BALLOT_NOT_OPEN,
    });
  });

  it.each([
    [new UnauthorizedException(), 'UNAUTHORIZED'],
    [new ForbiddenException(), 'FORBIDDEN'],
    [new NotFoundException('Cannot GET /api/v1/nope'), 'ROUTE_NOT_FOUND'],
  ])('turns a framework default into a translated code', (exception, code) => {
    expect(run(exception, 'ar')).toMatchObject({ code, message: AR[code as keyof typeof AR] });
  });

  it('passes an unmigrated message through unchanged, with the status code', () => {
    const result = run(new BadRequestException('Some legacy sentence'), 'fr');
    expect(result).toEqual({ code: 'BAD_REQUEST', message: 'Some legacy sentence' });
  });

  it('never leaks an uncoded 5xx message in production', () => {
    const result = run(new InternalServerErrorException('db pool exhausted at host x'), 'fr', true);
    expect(result.message).toBe(FR.INTERNAL_ERROR_WITH_ID);
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('keeps a coded 5xx message in production: catalogue copy is user-safe', () => {
    const result = run(new InternalServerErrorException(appError('DONATION_FAILED')), 'fr', true);
    expect(result).toMatchObject({ code: 'DONATION_FAILED', message: FR.DONATION_FAILED });
  });

  it('forwards the lockout fields the app needs, which used to be dropped', () => {
    const until = '2026-09-25T12:00:00.000Z';
    const result = run(
      new UnauthorizedException({ message: 'locked', type: 'ACCOUNT_LOCKED', blockedUntil: until }),
    );
    expect(result.details).toEqual({ type: 'ACCOUNT_LOCKED', blockedUntil: until });
  });

  it('forwards no internal detail: extras are allowlisted, and never on a 5xx', () => {
    const leaky = run(
      new BadRequestException({ message: 'x', stats: { rows: 3 }, details: 'raw stack' }),
    );
    expect(leaky.details).toBeUndefined();

    const server = run(
      new InternalServerErrorException({ message: 'x', blockedUntil: 'y', details: { a: 1 } }),
    );
    expect(server.details).toBeUndefined();
  });

  it('passes on a code outside the catalogue, so a client can still branch on it', () => {
    const result = run(new BadRequestException({ code: 'SOMETHING_NEW', message: 'English' }));
    expect(result).toMatchObject({ code: 'SOMETHING_NEW', message: 'English' });
  });
});

describe('validation errors', () => {
  class SignUp {
    @IsEmail()
    email!: string;

    @MinLength(12, { message: 'Password must be at least 12 characters long' })
    password!: string;
  }

  const failing = async (plain: Partial<SignUp>) => {
    const dto = Object.assign(new SignUp(), plain);
    return validationException(await validate(dto));
  };

  it('translates each field from its constraint, with the declared limits', async () => {
    const result = run(await failing({ email: 'nope', password: 'short' }), 'fr');

    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.errors).toEqual(
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
          message: expect.stringContaining('12'),
        }),
      ]),
    );
    expect(result.message).toBe(FR.VALIDATION_FAILED);
  });

  it('names the problem itself when only one field fails', async () => {
    const result = run(await failing({ email: 'a@b.tn', password: 'short' }), 'ar');
    expect(result.message).toContain('12');
    expect(result.message).not.toBe(AR.VALIDATION_FAILED);
  });

  it('keeps the English detail on the exception for the logs', async () => {
    const e = await failing({ email: 'nope', password: 'Abcdefghij1!' });
    expect(e.message).toMatch(/^Validation failed: /);
  });

  it('uses a DTO message that is itself a catalogue code', async () => {
    class Strict {
      @MinLength(12, { message: 'PASSWORD_POLICY' })
      password!: string;
    }
    const e = validationException(await validate(Object.assign(new Strict(), { password: 'x' })));
    expect(run(e, 'fr').message).toBe(FR.PASSWORD_POLICY);
  });
});
