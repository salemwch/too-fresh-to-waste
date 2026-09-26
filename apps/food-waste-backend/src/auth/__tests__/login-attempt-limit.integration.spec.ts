/**
 * The login attempt limit against a real Redis.
 *
 * The unit suite mocks AuthSecurityService, so it proves only that AuthService
 * calls it. Nothing there counts anything. This runs the real counters in the
 * real store, through the real login(), and checks four things:
 *
 *   1. MAX_LOGIN_ATTEMPTS failures block the email, and the block holds even
 *      for the correct password (the gate runs before the credential check,
 *      so it is not a password oracle).
 *   2. The whole sequence of responses is identical for a registered email and
 *      an unknown one - status, code, message and which details are present.
 *      Only the blockedUntil timestamp differs, because it is a clock.
 *   3. A successful login clears the counters.
 *   4. The counters really are in Redis. AuthSecurityService silently falls
 *      back to process memory when Redis is not connected, and every
 *      assertion above would still pass against that fallback - which is not
 *      shared between PM2 workers, so it would not limit anything in
 *      production.
 *
 * Needs REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (the local docker Redis, or
 * CI's redis service). It fails rather than skips when Redis is absent, for the
 * reason jest-integration.config.js gives.
 */

import { randomBytes } from 'node:crypto';

import { UserRole, UserStatus } from '@foodwaste/shared';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';

import { EN } from '../../common/errors/catalog/en';
import { MAX_LOGIN_ATTEMPTS } from '../../common/constants/lockout-policy.constant';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { PhoneNumberService } from '../../common/services/phone-number.service';
import { EmailService } from '../../email/email.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/user.service';
import { AuthService } from '../auth.service';
import { AuthSecurityService, pairAttemptKey } from '../services/auth-security.service';
import { CaptchaService } from '../services/captcha.service';
import { PasswordPolicyService } from '../services/password-policy.service';
import { TokenService } from '../services/token.service';
import { USER_PASSWORD_HASH_OPTIONS } from '../utils/password-hash';

import type { TestingModule } from '@nestjs/testing';

const PASSWORD = 'Correct-horse-9!';
const WRONG = 'Wrong-password-1!';

/** One login attempt, reduced to what the client receives. */
interface Outcome {
  status: number;
  code?: unknown;
  message?: unknown;
  detailKeys: string[];
}

const run = randomBytes(4).toString('hex');
const emailFor = (label: string) => `limit-${label}-${run}@example.test`;
const ipFor = (label: string) => `203.0.113.${label.length}-${run}`;

describe('login attempt limit (real Redis)', () => {
  let module: TestingModule;
  let auth: AuthService;
  let security: AuthSecurityService;
  let redis: Awaited<ReturnType<RedisService['getClient']>>;
  const users = new Map<string, Record<string, unknown>>();
  const touchedKeys: string[] = [];

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD, USER_PASSWORD_HASH_OPTIONS);
    for (const label of ['registered', 'clears', 'owner']) {
      users.set(emailFor(label), {
        _id: new Types.ObjectId(),
        email: emailFor(label),
        password: passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.CONSUMER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: false,
        tokenRevocationVersion: 0,
      });
    }

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthSecurityService,
        RedisService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            REDIS_HOST: process.env['REDIS_HOST'] ?? 'localhost',
            REDIS_PORT: process.env['REDIS_PORT'] ?? '6379',
            REDIS_PASSWORD: process.env['REDIS_PASSWORD'] ?? '',
          }),
        },
        {
          provide: UsersService,
          useValue: {
            // Synchronous on purpose: login() awaits it either way.
            findByEmail: jest.fn((email: string) => users.get(email) ?? null),
            incrementFailedLoginAttempts: jest.fn().mockResolvedValue(undefined),
            resetFailedLoginAttempts: jest.fn().mockResolvedValue(undefined),
            updateLastLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn().mockResolvedValue({
              accessToken: 'access',
              refreshToken: 'refresh',
              jti: 'jti',
              familyId: 'family',
            }),
          },
        },
        { provide: EventBusService, useValue: { emit: jest.fn().mockResolvedValue(undefined) } },
        { provide: JwtService, useValue: { sign: jest.fn(), signAsync: jest.fn() } },
        { provide: EmailService, useValue: {} },
        { provide: PasswordPolicyService, useValue: {} },
        { provide: PhoneNumberService, useValue: {} },
        { provide: CaptchaService, useValue: {} },
      ],
    }).compile();

    await module.init(); // RedisService connects in onModuleInit
    auth = module.get(AuthService);
    security = module.get(AuthSecurityService);
    const redisService = module.get(RedisService);
    expect(redisService.isConnected()).toBe(true);
    redis = await redisService.getClient();
  });

  afterAll(async () => {
    if (redis?.isOpen && touchedKeys.length > 0) {
      await redis.del(touchedKeys);
    }
    await module?.close();
  });

  /** Registers the Redis keys an attempt writes, so afterAll removes them. */
  const track = (email: string, ip: string) => {
    touchedKeys.push(`auth:attempts:${pairAttemptKey(email, ip)}`, `auth:attempts:ip:${ip}`);
  };

  async function attempt(email: string, ip: string, password: string): Promise<Outcome> {
    track(email, ip);
    try {
      await auth.login({ email, password }, { ipAddress: ip, userAgent: 'jest' });
      return { status: 200, detailKeys: [] };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        throw error;
      }
      const body = error.getResponse() as Record<string, unknown>;
      const details = (body['details'] ?? {}) as Record<string, unknown>;
      return {
        status: error.getStatus(),
        code: body['code'],
        message: body['message'],
        detailKeys: Object.keys(details).sort(),
      };
    }
  }

  /** MAX_LOGIN_ATTEMPTS wrong passwords, then one correct one. */
  async function exhaust(email: string, ip: string): Promise<Outcome[]> {
    const outcomes: Outcome[] = [];
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      outcomes.push(await attempt(email, ip, WRONG));
    }
    outcomes.push(await attempt(email, ip, PASSWORD));
    return outcomes;
  }

  const invalid: Outcome = {
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: EN.INVALID_CREDENTIALS,
    detailKeys: [],
  };
  const blocked: Outcome = {
    status: 429,
    code: 'LOGIN_TEMPORARILY_BLOCKED',
    message: EN.LOGIN_TEMPORARILY_BLOCKED,
    detailKeys: ['blockedUntil'],
  };

  it('blocks after MAX_LOGIN_ATTEMPTS failures, the same way for a registered and an unknown email', async () => {
    const registered = await exhaust(emailFor('registered'), ipFor('a'));
    const unknown = await exhaust(emailFor('nobody'), ipFor('bb'));

    const expected = [
      ...Array.from({ length: MAX_LOGIN_ATTEMPTS - 1 }, () => invalid),
      blocked, // the failure that reaches the limit
      blocked, // and the correct password after it
    ];
    expect(registered).toEqual(expected);
    expect(unknown).toEqual(registered);
  });

  it('keeps the counters in Redis, not in process memory', async () => {
    const key = `auth:attempts:${pairAttemptKey(emailFor('nobody'), ipFor('bb'))}`;
    const stored = await redis.get(key);

    expect(stored).not.toBeNull();
    expect(JSON.parse(String(stored))).toMatchObject({ count: MAX_LOGIN_ATTEMPTS });
    expect(await redis.ttl(key)).toBeGreaterThan(0);
  });

  it('clears the counters on a successful login', async () => {
    const email = emailFor('clears');
    const ip = ipFor('ccc');

    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      expect(await attempt(email, ip, WRONG)).toEqual(invalid);
    }
    expect((await attempt(email, ip, PASSWORD)).status).toBe(200);
    expect(await redis.get(`auth:attempts:${pairAttemptKey(email, ip)}`)).toBeNull();
    expect(await redis.get(`auth:attempts:ip:${ip}`)).toBeNull();

    // A fresh budget: one more failure is an ordinary 401, not the block the
    // uncleared count would have reached.
    expect(await attempt(email, ip, WRONG)).toEqual(invalid);
  });

  // Lockout abuse: keyed on the email alone, anyone could lock any account out
  // by sending ten wrong passwords for it. On the email+IP pair the attacker
  // blocks only their own address.
  it('does not lock the owner out because of failures from another IP', async () => {
    const email = emailFor('owner');
    const attacker = ipFor('dddd');
    const owner = ipFor('eeeee');

    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await attempt(email, attacker, WRONG);
    }
    expect(await attempt(email, attacker, PASSWORD)).toEqual(blocked);

    expect((await attempt(email, owner, PASSWORD)).status).toBe(200);
  });

  // Before, the counter key was the raw string, so every change of case was a
  // fresh budget of ten guesses for the same account.
  it('counts a change of letter case against the same email', async () => {
    const email = emailFor('case');
    const ip = ipFor('ffffff');
    const variants = [
      email,
      email.toUpperCase(),
      `  ${email.charAt(0).toUpperCase()}${email.slice(1)} `,
    ];

    for (const variant of variants) {
      expect(await attempt(variant, ip, WRONG)).toEqual(invalid);
    }

    // Read the email+IP counter itself: from one IP the per-IP counter would
    // reach the limit either way, so a block alone would not prove the key.
    const stored = await redis.get(`auth:attempts:${pairAttemptKey(email, ip)}`);
    expect(JSON.parse(String(stored))).toMatchObject({ count: variants.length });
  });

  it('an admin unlock clears the email on every IP, and nothing else', async () => {
    const email = emailFor('unlock');
    const other = emailFor('bystander');
    const [ipA, ipB] = [ipFor('ggggggg'), ipFor('hhhhhhhh')];
    await attempt(email, ipA, WRONG);
    await attempt(email, ipB, WRONG);
    await attempt(other, ipA, WRONG);

    await security.clearLoginAttempts('*', email);

    const stored = async (e: string, ip: string) => {
      const value = await redis.get(`auth:attempts:${pairAttemptKey(e, ip)}`);
      return value;
    };
    expect(await stored(email, ipA)).toBeNull();
    expect(await stored(email, ipB)).toBeNull();
    expect(await stored(other, ipA)).not.toBeNull();
  });
});
