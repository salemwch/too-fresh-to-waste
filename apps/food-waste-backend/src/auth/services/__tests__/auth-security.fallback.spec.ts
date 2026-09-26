/**
 * AuthSecurityService when Redis misbehaves, and what its logs may contain.
 *
 * The real-Redis behaviour (limit, email+IP key, case, unlock) is covered by
 * auth/__tests__/login-attempt-limit.integration.spec.ts. What that suite
 * cannot reach is a Redis that is connected but failing: every command
 * rejects. That used to read as "0 attempts, not blocked", which switched the
 * brute-force limit off exactly when Redis was in trouble.
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MAX_LOGIN_ATTEMPTS } from '../../../common/constants/lockout-policy.constant';
import type { EventBusService } from '../../../common/services/event-bus/event-bus.service';
import type { RedisService } from '../../../redis/redis.service';
import { AuthSecurityService, normalizeLoginEmail, pairAttemptKey } from '../auth-security.service';

const EMAIL = 'Victim.Person@Example.org';
const IP = '198.51.100.7';

const failingRedis = () => {
  const fail = jest
    .fn()
    .mockRejectedValue(new Error('READONLY You cannot write against a read only replica'));
  return { get: fail, setEx: fail, del: fail };
};

function build(redis: { connected: boolean; client?: unknown }): AuthSecurityService {
  const redisService = {
    isConnected: () => redis.connected,
    getClient: jest.fn().mockResolvedValue(redis.client),
  } as unknown as RedisService;
  const eventBus = { emit: jest.fn().mockResolvedValue(undefined) } as unknown as EventBusService;
  return new AuthSecurityService(new ConfigService({}), redisService, eventBus);
}

describe('login attempt keys', () => {
  it('normalizes case and surrounding space', () => {
    expect(normalizeLoginEmail('  Salem@GMAIL.com ')).toBe('salem@gmail.com');
  });

  it('keys the lockout on the email and the IP together', () => {
    expect(pairAttemptKey('A@x.tn', '1.2.3.4')).toBe('pair:a@x.tn|1.2.3.4');
    expect(pairAttemptKey('a@x.tn', '1.2.3.4')).toBe(pairAttemptKey(' A@X.TN', '1.2.3.4'));
    expect(pairAttemptKey('a@x.tn', '1.2.3.4')).not.toBe(pairAttemptKey('a@x.tn', '5.6.7.8'));
  });
});

describe('AuthSecurityService with a failing Redis', () => {
  let logs: jest.SpyInstance[];

  beforeEach(() => {
    logs = (['log', 'warn', 'error', 'debug'] as const).map(level =>
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('still blocks after MAX_LOGIN_ATTEMPTS failures when every Redis command rejects', async () => {
    const service = build({ connected: true, client: failingRedis() });

    expect((await service.checkLoginAttempts(IP, EMAIL)).allowed).toBe(true);
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await service.recordFailedLoginAttempt(IP, EMAIL);
    }

    const check = await service.checkLoginAttempts(IP, EMAIL);
    expect(check.allowed).toBe(false);
    expect(check.blockedUntil).toBeInstanceOf(Date);
  });

  it('a successful sign-in clears what was counted while Redis failed', async () => {
    const service = build({ connected: true, client: failingRedis() });
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      await service.recordFailedLoginAttempt(IP, EMAIL);
    }

    await service.clearLoginAttempts(IP, EMAIL);
    await service.recordFailedLoginAttempt(IP, EMAIL);

    expect((await service.checkLoginAttempts(IP, EMAIL)).allowed).toBe(true);
  });

  it('keeps the in-memory fallback bounded under a spray of distinct emails', async () => {
    const service = build({ connected: false });

    for (let i = 0; i < 6_000; i++) {
      await service.recordFailedLoginAttempt(
        `10.0.${Math.floor(i / 250)}.${i % 250}`,
        `spray${i}@x.tn`,
      );
    }

    const store = (service as unknown as { fallbackAttempts: Map<string, unknown> })
      .fallbackAttempts;
    expect(store.size).toBeLessThanOrEqual(10_000);
    // The newest attempt survives; the oldest went first.
    expect(store.has(pairAttemptKey('spray5999@x.tn', '10.0.23.249'))).toBe(true);
    expect(store.has(pairAttemptKey('spray0@x.tn', '10.0.0.0'))).toBe(false);
  });

  it('never writes the email address to a log line', async () => {
    const service = build({ connected: true, client: failingRedis() });

    for (let i = 0; i < MAX_LOGIN_ATTEMPTS + 1; i++) {
      await service.checkLoginAttempts(IP, EMAIL);
      await service.recordFailedLoginAttempt(IP, EMAIL);
    }
    await service.clearLoginAttempts('*', EMAIL);

    const written = logs.flatMap(spy => spy.mock.calls).map(call => JSON.stringify(call));
    expect(written.length).toBeGreaterThan(0);
    for (const line of written) {
      expect(line.toLowerCase()).not.toContain('victim.person');
    }
  });
});
