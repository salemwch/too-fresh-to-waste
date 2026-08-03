import {
  DEFAULT_SCAN_COUNT,
  MAX_SCAN_ITERATIONS,
  deleteByPattern,
  scanBatches,
  scanKeys,
  type ScannableRedisClient,
} from '../redis-scan.util';

interface ScanReply {
  cursor: string | number;
  keys: string[];
}

interface FakeRedis extends ScannableRedisClient {
  scan: jest.Mock;
  del: jest.Mock;
}

/**
 * Fake Redis exposing only the SCAN/DEL surface these helpers use.
 *
 * Built from `mockResolvedValueOnce` chains rather than hand-written async
 * bodies: the queue shape maps directly onto how real SCAN paginates, and it
 * keeps the double free of async function bodies that would need a filler
 * `await` to satisfy `require-await`.
 */
const fakeRedis = (pages: ScanReply[]): FakeRedis => {
  const scan = jest.fn();
  pages.forEach(page => scan.mockResolvedValueOnce(page));
  // Anything past the queued pages terminates iteration.
  scan.mockResolvedValue({ cursor: '0', keys: [] });

  // Default: DEL reports every key handed to it as removed.
  const del = jest.fn().mockImplementation(async (keys: string[]) => {
    const removed = await Promise.resolve(keys.length);
    return removed;
  });

  return { scan, del } as unknown as FakeRedis;
};

/** Cursor argument of each SCAN call, in order. */
const cursorsUsed = (redis: FakeRedis): string[] =>
  redis.scan.mock.calls.map(call => call[0] as string);

/** Key batches passed to each DEL call, in order. */
const deletedBatches = (redis: FakeRedis): string[][] =>
  redis.del.mock.calls.map(call => call[0] as string[]);

describe('redis-scan.util', () => {
  describe('scanBatches — iteration control', () => {
    it('stops after a single round-trip when the first reply returns the terminal cursor', async () => {
      const redis = fakeRedis([{ cursor: '0', keys: ['a', 'b'] }]);
      const seen: string[][] = [];

      const iterations = await scanBatches(redis, 'x:*', keys => {
        seen.push(keys);
      });

      expect(iterations).toBe(1);
      expect(seen).toEqual([['a', 'b']]);
    });

    it('follows the cursor across multiple pages until it returns to 0', async () => {
      const redis = fakeRedis([
        { cursor: '17', keys: ['a'] },
        { cursor: '42', keys: ['b'] },
        { cursor: '0', keys: ['c'] },
      ]);
      const seen: string[][] = [];

      const iterations = await scanBatches(redis, 'x:*', keys => {
        seen.push(keys);
      });

      expect(iterations).toBe(3);
      expect(seen).toEqual([['a'], ['b'], ['c']]);
      // Each call must carry the cursor the previous reply handed back —
      // restarting from '0' would loop over the same page forever.
      expect(cursorsUsed(redis)).toEqual(['0', '17', '42']);
    });

    it('coerces a numeric cursor to a string so termination is still detected', async () => {
      // node-redis has shipped both string and number cursors across versions.
      // A number 0 compared against '0' with !== would never terminate.
      const redis = fakeRedis([
        { cursor: 99, keys: ['a'] },
        { cursor: 0, keys: ['b'] },
      ]);

      const iterations = await scanBatches(redis, 'x:*', () => undefined);

      expect(iterations).toBe(2);
    });

    it('awaits an async callback before advancing the cursor', async () => {
      // The callback may do real I/O (the session cleanup issues sMembers/mGet
      // per batch). Advancing without awaiting would overlap batches.
      const redis = fakeRedis([
        { cursor: '1', keys: ['a'] },
        { cursor: '0', keys: ['b'] },
      ]);
      const order: string[] = [];

      await scanBatches(redis, 'x:*', async keys => {
        order.push(`start-${keys[0]}`);
        await Promise.resolve();
        order.push(`end-${keys[0]}`);
      });

      expect(order).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
    });

    it('does not invoke the callback for an empty page', async () => {
      // A SCAN page can legitimately match nothing while iteration continues.
      const redis = fakeRedis([
        { cursor: '5', keys: [] },
        { cursor: '0', keys: ['a'] },
      ]);
      const onBatch = jest.fn();

      await scanBatches(redis, 'x:*', onBatch);

      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(['a']);
    });

    it('passes the requested MATCH pattern and COUNT through to Redis', async () => {
      const redis = fakeRedis([{ cursor: '0', keys: [] }]);

      await scanBatches(redis, 'session:*', () => undefined, 250);

      expect(redis.scan).toHaveBeenCalledWith('0', { MATCH: 'session:*', COUNT: 250 });
    });

    it('defaults COUNT to DEFAULT_SCAN_COUNT', async () => {
      const redis = fakeRedis([{ cursor: '0', keys: [] }]);

      await scanBatches(redis, 'x:*', () => undefined);

      expect(redis.scan).toHaveBeenCalledWith('0', { MATCH: 'x:*', COUNT: DEFAULT_SCAN_COUNT });
    });

    it('bails out at MAX_SCAN_ITERATIONS when the cursor never returns to 0', async () => {
      // Guards the pathological case (resharding, buggy proxy) where SCAN never
      // terminates. Without the cap this spins forever and pins the event loop —
      // the exact failure this module exists to prevent.
      const neverTerminating = {
        scan: jest.fn().mockResolvedValue({ cursor: '1', keys: ['k'] }),
        del: jest.fn().mockResolvedValue(1),
      } as unknown as FakeRedis;

      const iterations = await scanBatches(neverTerminating, 'x:*', () => undefined);

      expect(iterations).toBe(MAX_SCAN_ITERATIONS);
    });

    it('propagates a callback rejection instead of continuing to scan', async () => {
      // A failing consumer must abort the walk — silently scanning on would
      // report success while having processed nothing.
      const redis = fakeRedis([
        { cursor: '1', keys: ['a'] },
        { cursor: '0', keys: ['b'] },
      ]);

      await expect(
        scanBatches(redis, 'x:*', () => {
          throw new Error('consumer failed');
        }),
      ).rejects.toThrow('consumer failed');

      expect(redis.scan).toHaveBeenCalledTimes(1);
    });
  });

  describe('scanKeys — collection', () => {
    it('accumulates keys across every page', async () => {
      const redis = fakeRedis([
        { cursor: '1', keys: ['a', 'b'] },
        { cursor: '0', keys: ['c'] },
      ]);

      await expect(scanKeys(redis, 'x:*')).resolves.toEqual(['a', 'b', 'c']);
    });

    it('de-duplicates keys returned by more than one iteration', async () => {
      // Real SCAN guarantees at-least-once, not exactly-once, delivery.
      const redis = fakeRedis([
        { cursor: '1', keys: ['a', 'b'] },
        { cursor: '0', keys: ['b', 'c'] },
      ]);

      await expect(scanKeys(redis, 'x:*')).resolves.toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array when nothing matches', async () => {
      const redis = fakeRedis([{ cursor: '0', keys: [] }]);

      await expect(scanKeys(redis, 'nope:*')).resolves.toEqual([]);
    });
  });

  describe('deleteByPattern — removal', () => {
    it('deletes each page as it is scanned rather than buffering every key', async () => {
      // Streaming is the point: KEYS pulls the whole keyspace into the heap.
      const redis = fakeRedis([
        { cursor: '1', keys: ['a', 'b'] },
        { cursor: '0', keys: ['c'] },
      ]);

      await deleteByPattern(redis, 'x:*');

      expect(deletedBatches(redis)).toEqual([['a', 'b'], ['c']]);
    });

    it('returns the total number of keys actually removed', async () => {
      const redis = fakeRedis([
        { cursor: '1', keys: ['a', 'b'] },
        { cursor: '0', keys: ['c'] },
      ]);

      await expect(deleteByPattern(redis, 'x:*')).resolves.toBe(3);
    });

    it('counts what DEL reports, not how many keys were scanned', async () => {
      // DEL is the source of truth: a key can expire between SCAN and DEL, and
      // SCAN can surface the same key twice, so counting scanned keys
      // over-reports. Here the first page finds one of two still present.
      const redis = fakeRedis([
        { cursor: '1', keys: ['a', 'gone'] },
        { cursor: '0', keys: ['b'] },
      ]);
      redis.del.mockReset();
      redis.del.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      await expect(deleteByPattern(redis, 'x:*')).resolves.toBe(2);
    });

    it('issues no DEL when nothing matches', async () => {
      const redis = fakeRedis([{ cursor: '0', keys: [] }]);

      await expect(deleteByPattern(redis, 'x:*')).resolves.toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('never calls the KEYS command', async () => {
      // The regression this whole module exists to prevent. KEYS is O(N) over
      // the entire keyspace and blocks single-threaded Redis, which here also
      // backs the throttler, Bull and the Socket.IO adapter.
      const redis = fakeRedis([{ cursor: '0', keys: ['a'] }]);
      const keysSpy = jest.fn();
      Object.assign(redis, { keys: keysSpy });

      await deleteByPattern(redis, 'x:*');

      expect(keysSpy).not.toHaveBeenCalled();
      expect(redis.scan).toHaveBeenCalled();
    });
  });
});
