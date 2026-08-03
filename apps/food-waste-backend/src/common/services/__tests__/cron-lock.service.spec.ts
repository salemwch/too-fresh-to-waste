/**
 * Single-owner execution for scheduled work.
 *
 * `@nestjs/schedule` registers timers in-process, so every replica fires every
 * cron. For `payout.task.ts` that means every merchant is paid once per
 * replica. These tests pin the properties that make scaling out safe.
 */

import { Test } from '@nestjs/testing';

import { RedisService } from '../../../redis/redis.service';
import { CronLockService } from '../cron-lock.service';

import type { TestingModule } from '@nestjs/testing';

describe('CronLockService', () => {
  let service: CronLockService;

  const redis = {
    set: jest.fn(),
    eval: jest.fn(),
  };
  const redisService = { getClient: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // 'OK' = lock acquired. node-redis returns null when NX finds the key set.
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);
    redisService.getClient.mockResolvedValue(redis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CronLockService, { provide: RedisService, useValue: redisService }],
    }).compile();

    service = module.get(CronLockService);
  });

  describe('acquiring', () => {
    it('runs the task when the lock is free', async () => {
      const task = jest.fn().mockResolvedValue('done');

      const result = await service.runExclusive('job', 1000, task);

      expect(task).toHaveBeenCalledTimes(1);
      expect(result).toBe('done');
    });

    it('acquires with NX and PX so exactly one replica can win', async () => {
      // NX is the whole mechanism. Without it every replica "acquires" and the
      // lock is decorative.
      await service.runExclusive('job', 5000, jest.fn().mockResolvedValue(undefined));

      expect(redis.set).toHaveBeenCalledWith('cronlock:job', expect.any(String), {
        NX: true,
        PX: 5000,
      });
    });

    it('namespaces the key so it cannot collide with cache or session keys', async () => {
      await service.runExclusive('payments.weekly-payouts', 1000, jest.fn());

      expect(redis.set).toHaveBeenCalledWith(
        'cronlock:payments.weekly-payouts',
        expect.any(String),
        expect.anything(),
      );
    });

    it('uses a distinct token per attempt', async () => {
      // Ownership check on release depends on the token being unguessable and
      // unique; a shared constant would let one replica release another's lock.
      await service.runExclusive('job', 1000, jest.fn());
      await service.runExclusive('job', 1000, jest.fn());

      const [firstToken, secondToken] = redis.set.mock.calls.map(call => call[1] as string);
      expect(firstToken).not.toBe(secondToken);
    });
  });

  describe('when another replica holds the lock', () => {
    beforeEach(() => {
      redis.set.mockResolvedValue(null); // NX failed
    });

    it('does NOT run the task', async () => {
      const task = jest.fn();

      await service.runExclusive('job', 1000, task);

      expect(task).not.toHaveBeenCalled();
    });

    it('resolves undefined rather than throwing', async () => {
      // Losing the race is the normal case on N-1 replicas every tick.
      await expect(service.runExclusive('job', 1000, jest.fn())).resolves.toBeUndefined();
    });

    it('does not release a lock it never acquired', async () => {
      await service.runExclusive('job', 1000, jest.fn());

      expect(redis.eval).not.toHaveBeenCalled();
    });
  });

  describe('releasing', () => {
    it('releases after the task succeeds', async () => {
      await service.runExclusive('job', 1000, jest.fn().mockResolvedValue(undefined));

      expect(redis.eval).toHaveBeenCalledTimes(1);
    });

    it('releases even when the task throws, and rethrows', async () => {
      // A crashed job must not hold the lock until its TTL — that would skip
      // the next tick too.
      const task = jest.fn().mockRejectedValue(new Error('job blew up'));

      await expect(service.runExclusive('job', 1000, task)).rejects.toThrow('job blew up');
      expect(redis.eval).toHaveBeenCalledTimes(1);
    });

    it('releases with a compare-and-delete carrying the token it wrote', async () => {
      // A bare DEL would delete whatever is there — including a lock a *different*
      // replica acquired after ours expired, letting two runs overlap.
      await service.runExclusive('job', 1000, jest.fn());

      const token = redis.set.mock.calls[0][1] as string;
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
        { keys: ['cronlock:job'], arguments: [token] },
      );
    });

    it('does not fail the run when release fails', async () => {
      redis.eval.mockRejectedValue(new Error('redis gone'));

      await expect(
        service.runExclusive('job', 1000, jest.fn().mockResolvedValue('ok')),
      ).resolves.toBe('ok');
    });

    it('does not fail the run when the lock had already expired', async () => {
      // eval returning 0 means someone else owns it now — the job outran its TTL.
      redis.eval.mockResolvedValue(0);

      await expect(
        service.runExclusive('job', 1000, jest.fn().mockResolvedValue('ok')),
      ).resolves.toBe('ok');
    });
  });

  describe('when Redis is unavailable', () => {
    beforeEach(() => {
      redisService.getClient.mockRejectedValue(new Error('redis down'));
    });

    it('fails CLOSED by default — skips the task', async () => {
      // The critical policy decision. Running unlocked is exactly the failure
      // this service prevents; a late payout beats a double payout.
      const task = jest.fn();

      const result = await service.runExclusive('payments.weekly-payouts', 1000, task);

      expect(task).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('does not throw when failing closed', async () => {
      // Thrown from a cron callback this would become an unhandled rejection.
      await expect(service.runExclusive('job', 1000, jest.fn())).resolves.toBeUndefined();
    });

    it('runs unlocked only when the caller explicitly opts in', async () => {
      const task = jest.fn().mockResolvedValue('ran');

      const result = await service.runExclusive('job', 1000, task, {
        runWithoutLockIfRedisDown: true,
      });

      expect(task).toHaveBeenCalledTimes(1);
      expect(result).toBe('ran');
    });

    it('propagates a task failure in the opt-in unlocked path', async () => {
      const task = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(
        service.runExclusive('job', 1000, task, { runWithoutLockIfRedisDown: true }),
      ).rejects.toThrow('boom');
    });
  });

  describe('result passthrough', () => {
    it('returns the task result unchanged, including falsy values', async () => {
      // 0 and '' must not be confused with "did not run".
      await expect(service.runExclusive('a', 1000, jest.fn().mockResolvedValue(0))).resolves.toBe(
        0,
      );
      await expect(service.runExclusive('b', 1000, jest.fn().mockResolvedValue(''))).resolves.toBe(
        '',
      );
      await expect(
        service.runExclusive('c', 1000, jest.fn().mockResolvedValue(false)),
      ).resolves.toBe(false);
    });
  });

  describe('concurrency', () => {
    it('only one of several simultaneous callers runs the task', async () => {
      // Simulates N replicas hitting the same tick: Redis grants NX to one.
      let granted = false;
      redis.set.mockImplementation(async () => {
        // Check-and-set BEFORE the first await. An async body runs
        // synchronously up to its first `await`, which is what makes this
        // atomic with respect to the other callers — the same guarantee real
        // Redis gives via SET NX. Reading `granted` after an await would let
        // all three callers observe `false` and every one of them "win".
        const wasAlreadyHeld = granted;
        granted = true;
        const reply = await Promise.resolve(wasAlreadyHeld ? null : 'OK');
        return reply;
      });

      const task = jest.fn().mockResolvedValue(undefined);

      await Promise.all([
        service.runExclusive('job', 1000, task),
        service.runExclusive('job', 1000, task),
        service.runExclusive('job', 1000, task),
      ]);

      expect(task).toHaveBeenCalledTimes(1);
    });
  });
});
