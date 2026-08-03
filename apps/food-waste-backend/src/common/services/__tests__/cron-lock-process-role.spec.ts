/**
 * The `PROCESS_ROLE` gate in `CronLockService.runExclusive`.
 *
 * Splitting scheduled work off the API processes is an availability measure: a
 * heavy rollup must not share an event loop with checkout. But the gate sits in
 * front of every scheduled job in the system, so getting it wrong has exactly
 * one symptom — nothing runs, quietly. Payouts stop, orders never expire, and
 * the service looks perfectly healthy the whole time.
 *
 * These tests pin both directions: that `api` really does skip, and that every
 * other value really does run. The second half matters more than the first.
 */

import { Test } from '@nestjs/testing';

import { RedisService } from '../../../redis/redis.service';
import { CronLockService } from '../cron-lock.service';

import type { TestingModule } from '@nestjs/testing';

describe('CronLockService — PROCESS_ROLE gate', () => {
  let service: CronLockService;

  const redis = { set: jest.fn(), eval: jest.fn() };
  const redisService = { getClient: jest.fn() };

  /** Restored after each test so one case cannot leak a role into the next. */
  const originalRole = process.env['PROCESS_ROLE'];

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);
    redisService.getClient.mockResolvedValue(redis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronLockService, { provide: RedisService, useValue: redisService }],
    }).compile();

    service = module.get(CronLockService);
  });

  afterEach(() => {
    if (originalRole === undefined) {
      delete process.env['PROCESS_ROLE'];
    } else {
      process.env['PROCESS_ROLE'] = originalRole;
    }
  });

  describe('when this process does not run scheduled work', () => {
    beforeEach(() => {
      process.env['PROCESS_ROLE'] = 'api';
    });

    it('does not run the job', async () => {
      const task = jest.fn().mockResolvedValue('done');

      const result = await service.runExclusive('payments.weekly-payouts', 1000, task);

      expect(task).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('skips without touching Redis at all', async () => {
      // The point of gating before the lock: N API replicas each firing every
      // cron would otherwise issue a SET NX per job per tick purely to learn
      // they are not the scheduler.
      await service.runExclusive('orders.expire-orders', 1000, jest.fn());

      expect(redisService.getClient).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('still skips when the caller opted out of the lock', async () => {
      // `runWithoutLockIfRedisDown` relaxes the *locking* policy. It must not
      // be readable as "run this job regardless of role" — that would put
      // scheduled work back on the API processes through a side door.
      const task = jest.fn();

      await service.runExclusive('job', 1000, task, { runWithoutLockIfRedisDown: true });

      expect(task).not.toHaveBeenCalled();
    });
  });

  describe('when this process runs scheduled work', () => {
    it.each([
      ['worker', 'the dedicated scheduled-work process'],
      ['all', 'a single-process deployment'],
    ])('runs the job for PROCESS_ROLE=%s (%s)', async role => {
      process.env['PROCESS_ROLE'] = role;
      const task = jest.fn().mockResolvedValue('done');

      const result = await service.runExclusive('job', 1000, task);

      expect(task).toHaveBeenCalledTimes(1);
      expect(result).toBe('done');
    });

    it('runs the job when PROCESS_ROLE is unset', async () => {
      // The default has to be "run". Every existing deployment sets no such
      // variable, and defaulting to skip would silently stop all scheduled work
      // the moment this code shipped.
      delete process.env['PROCESS_ROLE'];
      const task = jest.fn().mockResolvedValue('done');

      await service.runExclusive('job', 1000, task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('runs the job when PROCESS_ROLE is an unrecognised value', async () => {
      // Joi rejects bad values at startup, so this is only reachable if that
      // validation is bypassed. Failing open is deliberate: doing redundant
      // lock-protected work costs nothing, whereas failing closed over a typo
      // stops payouts with no error anywhere.
      process.env['PROCESS_ROLE'] = 'API_SERVER';
      const task = jest.fn().mockResolvedValue('done');

      await service.runExclusive('job', 1000, task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('is case- and whitespace-insensitive', async () => {
      // Container orchestrators and .env files both produce stray whitespace.
      process.env['PROCESS_ROLE'] = '  Api  ';
      const task = jest.fn();

      await service.runExclusive('job', 1000, task);

      expect(task).not.toHaveBeenCalled();
    });
  });
});
