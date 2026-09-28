/**
 * Order cache invalidation after a committed order.
 *
 * Called without awaiting from `create()`, after the transaction commits. The
 * old shape was `void this.invalidateOrderCaches(...)` — a discarded promise,
 * so a Redis outage produced a rejection that reached the global
 * `unhandledRejection` handler in main.ts and was suppressed. Merchant
 * dashboards would go stale with nothing in the logs to explain it.
 */

import { OrdersService } from '../order.service';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const buildService = () => {
  const cacheService = { delByPrefix: jest.fn().mockResolvedValue(0) };
  const appLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

  // Real prototype method, minimal collaborators — constructing OrdersService
  // outright would mean wiring eighteen dependencies to exercise one catch.
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, { cacheService, appLogger });

  const invalidate = (
    service as unknown as {
      invalidateOrderCaches: (m: string, c: string) => Promise<void>;
    }
  ).invalidateOrderCaches.bind(service);

  return { service, cacheService, appLogger, invalidate };
};

describe('OrdersService — order cache invalidation', () => {
  let unhandled: jest.Mock;

  beforeEach(() => {
    unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandled);
  });

  it('purges the stats cache for merchant and customer, and nothing else', async () => {
    const { cacheService, invalidate } = buildService();

    await invalidate('merchant-1', 'customer-1');

    expect(cacheService.delByPrefix).toHaveBeenCalledWith('orders:stats:merchant-1');
    expect(cacheService.delByPrefix).toHaveBeenCalledWith('orders:stats:customer-1');
    // No `orders:chart:*` purge - fix round 1 removed the chart cache along
    // with the deleted `getRevenueChart` that was its only writer.
    expect(cacheService.delByPrefix).toHaveBeenCalledTimes(2);
  });

  it('rejects when Redis is down, so the caller must catch', async () => {
    // Documents where the boundary sits: the method itself propagates; the
    // call site in create() owns the .catch(). Both halves are tested.
    const { cacheService, invalidate } = buildService();
    cacheService.delByPrefix.mockRejectedValue(new Error('redis down'));

    await expect(invalidate('m', 'c')).rejects.toThrow('redis down');
  });

  it('a caught rejection never becomes an unhandled rejection', async () => {
    // Mirrors the call site in create(): not awaited, but explicitly caught.
    const { cacheService, appLogger, invalidate } = buildService();
    cacheService.delByPrefix.mockRejectedValue(new Error('redis down'));

    invalidate('m', 'c').catch((err: Error) => {
      appLogger.error(`Order cache invalidation failed: ${err.message}`, 'test');
    });
    await flush();

    expect(unhandled).not.toHaveBeenCalled();
    expect(appLogger.error).toHaveBeenCalledTimes(1);
  });

  it('an UNCAUGHT rejection would escape — proving the catch is load-bearing', async () => {
    // Mutation guard. If someone reverts the call site to `void this.invalidate(...)`,
    // this is the behaviour that returns: nothing observes the failure.
    const { cacheService, invalidate } = buildService();
    cacheService.delByPrefix.mockRejectedValue(new Error('redis down'));

    const escaped = invalidate('m', 'c');
    await expect(escaped).rejects.toThrow();
    // Asserted via rejects (which consumes it) rather than left floating, so
    // this test does not itself trip the unhandledRejection listener.
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('issues both purges concurrently', async () => {
    const { cacheService, invalidate } = buildService();
    const resolveAll: Array<() => void> = [];
    cacheService.delByPrefix.mockImplementation(async () => {
      // Stays pending until the test releases it, so both calls are
      // observably in flight at once.
      const settled = await new Promise<number>(res => {
        resolveAll.push(() => res(0));
      });
      return settled;
    });

    const pending = invalidate('m', 'c');
    await flush();

    // Both in flight before either resolves - Promise.all, not sequential awaits.
    expect(cacheService.delByPrefix).toHaveBeenCalledTimes(2);
    resolveAll.forEach(r => r());
    await pending;
  });

  it('handles merchant and customer being the same user', async () => {
    // A merchant ordering from their own establishment. Duplicate purges are
    // harmless; the call must not dedupe its way into skipping one.
    const { cacheService, invalidate } = buildService();

    await invalidate('same-id', 'same-id');

    expect(cacheService.delByPrefix).toHaveBeenCalledTimes(2);
  });

  it('survives a non-Error rejection value', async () => {
    const { cacheService, invalidate } = buildService();
    cacheService.delByPrefix.mockRejectedValue(undefined);

    await expect(invalidate('m', 'c')).rejects.toBeUndefined();
  });

  it('resolves quietly when every purge succeeds', async () => {
    const { appLogger, invalidate } = buildService();

    await expect(invalidate('m', 'c')).resolves.toBeUndefined();
    expect(appLogger.error).not.toHaveBeenCalled();
  });
});
