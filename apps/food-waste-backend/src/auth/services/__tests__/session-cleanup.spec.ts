/**
 * Session cleanup — orphaned `user:sessions:*` set members.
 *
 * Regression coverage for the KEYS removal. The old implementation ran
 * `redisClient.keys('session:*')` on a timer and then a sequential GET per key.
 * That was wrong twice over:
 *
 *  1. KEYS is O(N) over the entire keyspace and blocks single-threaded Redis,
 *     which in this deployment also backs the throttler, Bull and the Socket.IO
 *     adapter — one blocking command stalls all four.
 *  2. It could not find what it was looking for. Redis TTL has already removed
 *     expired `session:*` keys, so scanning that prefix returns only LIVE
 *     sessions. The actual leak is in `user:sessions:{userId}` SETs, which
 *     carry no TTL and accumulate dead session IDs forever.
 *
 * These tests drive the private cleanup through the module lifecycle + fake
 * timers, the same way it runs in production.
 */

import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { RedisService } from '../../../redis/redis.service';
import { User } from '../../../users/schemas/user.schema';
import { SessionManagementService } from '../session-management.service';

import type { TestingModule } from '@nestjs/testing';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface ScanPage {
  cursor: string;
  keys: string[];
}

describe('SessionManagementService — expired session cleanup', () => {
  let service: SessionManagementService;

  const redis = {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    mGet: jest.fn(),
    scan: jest.fn(),
    keys: jest.fn(),
  };

  /** Queues SCAN replies so the helper walks them in order. */
  const givenScanPages = (pages: ScanPage[]): void => {
    redis.scan.mockReset();
    pages.forEach(page => redis.scan.mockResolvedValueOnce(page));
    // Anything past the queued pages terminates iteration.
    redis.scan.mockResolvedValue({ cursor: '0', keys: [] });
  };

  /**
   * Runs the cleanup exactly once and waits for it to finish.
   *
   * Invoked directly rather than by advancing the timer: the cleanup awaits a
   * variable number of round-trips (scan → sMembers → mGet → sRem/del), so the
   * number of microtask flushes needed after `advanceTimersByTime` depends on
   * the fixture. Awaiting the returned promise is deterministic. The timer
   * wiring itself is covered separately by the lifecycle test below.
   */
  const runCleanup = async (): Promise<void> => {
    await (
      service as unknown as { cleanupExpiredSessions: () => Promise<void> }
    ).cleanupExpiredSessions();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    redis.del.mockResolvedValue(1);
    redis.sRem.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagementService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, number> = {
                SESSION_MAX_CONCURRENT: 5,
                SESSION_TIMEOUT_MS: 15 * 60 * 1000,
                SESSION_REMEMBER_ME_MS: 30 * 24 * 60 * 60 * 1000,
                SESSION_CLEANUP_INTERVAL_MS: CLEANUP_INTERVAL_MS,
                SESSION_SUSPICIOUS_THRESHOLD: 3,
              };
              return config[key];
            }),
          },
        },
        {
          provide: RedisService,
          useValue: { getClient: jest.fn().mockResolvedValue(redis) },
        },
        {
          provide: getModelToken(User.name),
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SessionManagementService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('never issues a KEYS command', async () => {
    // The core regression. KEYS blocks the shared Redis event loop.
    givenScanPages([{ cursor: '0', keys: [] }]);

    await runCleanup();

    expect(redis.keys).not.toHaveBeenCalled();
  });

  it('scans the user:sessions namespace, not the session namespace', async () => {
    // Scanning `session:*` cannot find orphans — TTL already removed those keys.
    // The leak lives in the SETs, so that is what must be walked.
    givenScanPages([{ cursor: '0', keys: [] }]);

    await runCleanup();

    expect(redis.scan).toHaveBeenCalledWith(
      '0',
      expect.objectContaining({ MATCH: 'user:sessions:*' }),
    );
  });

  it('removes set members whose session key has expired', async () => {
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue(['live-1', 'dead-1', 'dead-2']);
    // MGET returns null in the slot of any key that no longer exists.
    redis.mGet.mockResolvedValue(['{"sessionId":"live-1"}', null, null]);

    await runCleanup();

    expect(redis.sRem).toHaveBeenCalledWith('user:sessions:u1', ['dead-1', 'dead-2']);
  });

  it('resolves every member of a set in ONE mGet, not a GET per member', async () => {
    // The old code issued a sequential GET per key. At 100k sessions that is
    // 100k round-trips per tick, per replica.
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue(['a', 'b', 'c']);
    redis.mGet.mockResolvedValue([null, null, null]);

    await runCleanup();

    expect(redis.mGet).toHaveBeenCalledTimes(1);
    expect(redis.mGet).toHaveBeenCalledWith(['session:a', 'session:b', 'session:c']);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('leaves a set untouched when every member is still live', async () => {
    // A failed/no-op pass must not mutate state.
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue(['live-1', 'live-2']);
    redis.mGet.mockResolvedValue(['{"a":1}', '{"b":2}']);

    await runCleanup();

    expect(redis.sRem).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('deletes the set key when every member turned out to be stale', async () => {
    // Otherwise an empty SET lingers forever for every user who ever signed out.
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue(['dead-1', 'dead-2']);
    redis.mGet.mockResolvedValue([null, null]);

    await runCleanup();

    expect(redis.sRem).toHaveBeenCalledWith('user:sessions:u1', ['dead-1', 'dead-2']);
    expect(redis.del).toHaveBeenCalledWith(['user:sessions:u1']);
  });

  it('reclaims an already-empty set without calling mGet', async () => {
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue([]);

    await runCleanup();

    expect(redis.del).toHaveBeenCalledWith(['user:sessions:u1']);
    expect(redis.mGet).not.toHaveBeenCalled();
  });

  it('processes every set across multiple SCAN pages', async () => {
    givenScanPages([
      { cursor: '7', keys: ['user:sessions:u1'] },
      { cursor: '0', keys: ['user:sessions:u2'] },
    ]);
    redis.sMembers.mockResolvedValue(['dead']);
    redis.mGet.mockResolvedValue([null]);

    await runCleanup();

    expect(redis.sMembers).toHaveBeenCalledWith('user:sessions:u1');
    expect(redis.sMembers).toHaveBeenCalledWith('user:sessions:u2');
  });

  it('does nothing when no session sets exist at all', async () => {
    givenScanPages([{ cursor: '0', keys: [] }]);

    await runCleanup();

    expect(redis.sMembers).not.toHaveBeenCalled();
    expect(redis.sRem).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('rebuilds session keys with the same prefix used when storing them', async () => {
    // If the `session:` prefix ever drifts between the store path and the
    // cleanup path, cleanup treats every live session as an orphan and empties
    // the mapping sets — silently signing everyone out of session listings.
    givenScanPages([{ cursor: '0', keys: ['user:sessions:u1'] }]);
    redis.sMembers.mockResolvedValue(['abc']);
    redis.mGet.mockResolvedValue(['{"sessionId":"abc"}']);

    await runCleanup();

    expect(redis.mGet).toHaveBeenCalledWith(['session:abc']);
    expect(redis.sRem).not.toHaveBeenCalled();
  });

  it('propagates a Redis failure to its caller, which the timer then catches', async () => {
    // cleanupExpiredSessions itself does not swallow — startCleanupTimer owns
    // the .catch(). Asserting the rejection here documents where the boundary
    // is; the next test proves the timer actually holds it.
    redis.scan.mockRejectedValue(new Error('redis down'));

    await expect(runCleanup()).rejects.toThrow('redis down');
  });

  describe('cleanup timer wiring', () => {
    /**
     * Advances to the next tick and lets the resulting async chain start.
     * The cleanup awaits `getClient()` before it can issue SCAN, so the call
     * lands a microtask after the timer fires, not synchronously with it.
     */
    const advanceOneTick = async (): Promise<void> => {
      jest.advanceTimersByTime(CLEANUP_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    };

    it('schedules cleanup on the configured interval', async () => {
      givenScanPages([{ cursor: '0', keys: [] }]);

      service.onModuleInit();
      expect(redis.scan).not.toHaveBeenCalled();

      await advanceOneTick();
      expect(redis.scan).toHaveBeenCalled();
    });

    it('does not run cleanup again after the module is destroyed', async () => {
      givenScanPages([{ cursor: '0', keys: [] }]);

      service.onModuleInit();
      await advanceOneTick();
      const callsBeforeDestroy = redis.scan.mock.calls.length;
      // Guards against the assertion below passing vacuously.
      expect(callsBeforeDestroy).toBeGreaterThan(0);

      service.onModuleDestroy();
      await advanceOneTick();
      await advanceOneTick();

      // A timer surviving shutdown keeps a dead instance reachable and issues
      // Redis commands against a closing connection.
      expect(redis.scan.mock.calls.length).toBe(callsBeforeDestroy);
    });

    it('a Redis failure inside the timer never becomes an unhandled rejection', async () => {
      redis.scan.mockRejectedValue(new Error('redis down'));
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      service.onModuleInit();
      jest.advanceTimersByTime(CLEANUP_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });
  });
});
