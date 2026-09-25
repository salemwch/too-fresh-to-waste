/**
 * PasswordPolicyService, real - every other spec mocks it.
 *
 * Two things this pins:
 *
 * 1. PASSWORD_MIN_LENGTH can raise the minimum, never lower it. `.env.example`
 *    shipped `PASSWORD_MIN_LENGTH=8`, which made this service - the only check
 *    on `POST /users`, the seed scripts and `GET /auth/password-policy` - accept
 *    and advertise 8 characters while every client and DTO said 12.
 * 2. A rejected password gets the code that describes why. PASSWORD_POLICY's
 *    copy lists the length and character rules, so a well-formed but common or
 *    guessable password gets PASSWORD_TOO_WEAK instead of being told to meet
 *    rules it already meets.
 */

import { PASSWORD_MIN_LENGTH } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';

import { PasswordPolicyService } from '../password-policy.service';

import type { PasswordHistoryService } from '../password-history.service';
import type { ConfigService } from '@nestjs/config';

const serviceWith = (env: Record<string, string>) =>
  new PasswordPolicyService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    {} as PasswordHistoryService,
  );

const rejectionCode = (service: PasswordPolicyService, password: string): unknown => {
  try {
    service.validatePasswordStrength(password);
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { code?: unknown }).code;
    }
    throw error;
  }
  return null;
};

describe('PasswordPolicyService', () => {
  describe('minimum length', () => {
    it.each([
      ['unset', {}, PASSWORD_MIN_LENGTH],
      [
        'lower than the shared minimum (the old example value)',
        { PASSWORD_MIN_LENGTH: '8' },
        PASSWORD_MIN_LENGTH,
      ],
      ['higher than the shared minimum', { PASSWORD_MIN_LENGTH: '16' }, 16],
      ['not a number', { PASSWORD_MIN_LENGTH: 'twelve' }, PASSWORD_MIN_LENGTH],
    ])('env %s', (_case, env, expected) => {
      expect(serviceWith(env).getPasswordPolicy().minLength).toBe(expected);
    });

    it('rejects a strong 10-character password even when env says 8', () => {
      expect(rejectionCode(serviceWith({ PASSWORD_MIN_LENGTH: '8' }), 'Xq7$vR2!mK')).toBe(
        'PASSWORD_POLICY',
      );
    });
  });

  describe('rejection code', () => {
    const service = serviceWith({});

    it.each([
      ['too short', 'Aa1!aa'],
      ['no uppercase', 'correct@horse9battery'],
      ['no special character', 'CorrectHorse9Battery'],
    ])('%s -> PASSWORD_POLICY (the rule it breaks is in the copy)', (_case, password) => {
      expect(rejectionCode(service, password)).toBe('PASSWORD_POLICY');
    });

    it('well formed but repetitive -> PASSWORD_TOO_WEAK', () => {
      // 12 characters, every class present, and five 1s in a row.
      expect(rejectionCode(service, 'Abcdef11111!')).toBe('PASSWORD_TOO_WEAK');
    });

    it('a strong password is accepted', () => {
      expect(rejectionCode(service, 'Correct@Horse9Battery')).toBeNull();
    });
  });
});
