/**
 * Fire-and-forget cache invalidation must never become an unhandled rejection.
 *
 * These calls are deliberately not awaited: the offer write has already
 * committed, and a Redis hiccup must not turn a successful mutation into a 500.
 * But the previous shape was `void this.cacheService.delByPrefix(...)`, which
 * discards the promise entirely. On rejection that reaches the global
 * `unhandledRejection` handler in main.ts — which *suppresses* it — so a Redis
 * outage would silently serve stale offer lists with nothing in the logs.
 *
 * The contract under test: never reject, never block, always log on failure.
 */

import { OffersService } from '../offers.service';

interface CacheStub {
  delByPrefix: jest.Mock;
}

interface LoggerStub {
  warn: jest.Mock;
  log: jest.Mock;
  error: jest.Mock;
}

/**
 * Builds a service exposing only what this helper touches.
 *
 * `Object.create` on the real prototype runs the REAL method — constructing the
 * full service would mean wiring eighteen unrelated collaborators to test one
 * catch block, and stubbing the method would test a copy of the code rather
 * than the code.
 */
const buildService = (): {
  service: OffersService;
  cache: CacheStub;
  logger: LoggerStub;
  invalidate: (...prefixes: string[]) => void;
} => {
  const cache: CacheStub = { delByPrefix: jest.fn().mockResolvedValue(0) };
  const logger: LoggerStub = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

  const service = Object.create(OffersService.prototype) as OffersService;
  Object.assign(service, { cacheService: cache, logger });

  const invalidate = (
    service as unknown as { invalidateDiscoveryCaches: (...p: string[]) => void }
  ).invalidateDiscoveryCaches.bind(service);

  return { service, cache, logger, invalidate };
};

/** Lets any fire-and-forget chain settle. */
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('OffersService — discovery cache invalidation', () => {
  let unhandled: jest.Mock;

  beforeEach(() => {
    unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandled);
  });

  describe('happy path', () => {
    it('purges every prefix it is given', async () => {
      const { cache, invalidate } = buildService();

      invalidate('offers:featured:', 'offers:urgent:');
      await flush();

      expect(cache.delByPrefix).toHaveBeenCalledWith('offers:featured:');
      expect(cache.delByPrefix).toHaveBeenCalledWith('offers:urgent:');
      expect(cache.delByPrefix).toHaveBeenCalledTimes(2);
    });

    it('purges a single prefix', async () => {
      const { cache, invalidate } = buildService();

      invalidate('offers:featured:');
      await flush();

      expect(cache.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it('logs nothing when every purge succeeds', async () => {
      const { logger, invalidate } = buildService();

      invalidate('offers:featured:');
      await flush();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('issues the purges concurrently rather than one after another', async () => {
      // Sequential awaits would add a round-trip per prefix to a path that is
      // supposed to be off the critical path entirely.
      const { cache, invalidate } = buildService();
      let resolveFirst!: () => void;
      cache.delByPrefix
        .mockImplementationOnce(async () => {
          const settled = await new Promise<number>(res => {
            resolveFirst = () => res(0);
          });
          return settled;
        })
        .mockResolvedValueOnce(0);

      invalidate('a:', 'b:');
      await flush();

      // The second call must have been made without waiting for the first.
      expect(cache.delByPrefix).toHaveBeenCalledTimes(2);
      resolveFirst();
      await flush();
    });
  });

  describe('failure path', () => {
    it('does not throw synchronously when Redis is down', () => {
      const { cache, invalidate } = buildService();
      cache.delByPrefix.mockRejectedValue(new Error('redis down'));

      expect(() => invalidate('offers:featured:')).not.toThrow();
    });

    it('never produces an unhandled rejection', async () => {
      // The core regression. `void promise` on a rejecting promise lands in the
      // global handler, which swallows it — the failure becomes invisible.
      const { cache, invalidate } = buildService();
      cache.delByPrefix.mockRejectedValue(new Error('redis down'));

      invalidate('offers:featured:', 'offers:urgent:');
      await flush();

      expect(unhandled).not.toHaveBeenCalled();
    });

    it('logs a warning naming the prefixes that failed', async () => {
      const { cache, logger, invalidate } = buildService();
      cache.delByPrefix.mockRejectedValue(new Error('redis down'));

      invalidate('offers:featured:', 'offers:urgent:');
      await flush();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const message = String(logger.warn.mock.calls[0][0]);
      expect(message).toContain('offers:featured:');
      expect(message).toContain('offers:urgent:');
      expect(message).toContain('redis down');
    });

    it('logs once when several prefixes fail, not once per prefix', async () => {
      // Promise.all rejects on the first failure; a per-prefix catch would spam
      // the log during an outage, which is when it is least readable.
      const { cache, logger, invalidate } = buildService();
      cache.delByPrefix.mockRejectedValue(new Error('redis down'));

      invalidate('a:', 'b:', 'c:');
      await flush();

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('still logs when only one of several prefixes fails', async () => {
      const { cache, logger, invalidate } = buildService();
      cache.delByPrefix
        .mockResolvedValueOnce(3)
        .mockRejectedValueOnce(new Error('partial failure'));

      invalidate('ok:', 'bad:');
      await flush();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('survives a non-Error rejection value', async () => {
      // Redis clients have been known to reject with undefined on shutdown —
      // see the unhandledRejection note in main.ts.
      const { cache, logger, invalidate } = buildService();
      cache.delByPrefix.mockRejectedValue(undefined);

      invalidate('offers:featured:');
      await flush();

      expect(unhandled).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('does not block the caller while the purge is in flight', async () => {
      // The whole point of not awaiting: a slow Redis must not extend the
      // request that already committed its write.
      const { cache, invalidate } = buildService();
      let releasePurge!: () => void;
      cache.delByPrefix.mockImplementation(async () => {
        const settled = await new Promise<number>(res => {
          releasePurge = () => res(0);
        });
        return settled;
      });

      const before = Date.now();
      invalidate('offers:featured:');
      const elapsed = Date.now() - before;

      expect(elapsed).toBeLessThan(100);

      // Settle the pending promise so it does not outlive the test.
      releasePurge();
      await flush();
    });
  });

  describe('edge cases', () => {
    it('does nothing when called with no prefixes', async () => {
      const { cache, logger, invalidate } = buildService();

      invalidate();
      await flush();

      expect(cache.delByPrefix).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns undefined — it is fire-and-forget, not awaitable', () => {
      // Guards against someone "fixing" this by returning the promise: callers
      // would then be able to await it and reintroduce the blocking behaviour.
      const { invalidate } = buildService();

      expect(invalidate('offers:featured:')).toBeUndefined();
    });
  });
});
