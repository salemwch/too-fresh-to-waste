/**
 * Cache **correctness** for the filtered urgent feed — not key uniqueness.
 *
 * `urgent-establishment-filter.spec.ts` asserts that keys differ and match as
 * intended. Distinct keys are necessary but not sufficient: what actually
 * matters to a user is the invariant below, and it is possible to satisfy every
 * key assertion and still violate it — for instance by normalising for the key
 * but not for the query, which would cache a correctly-labelled entry holding
 * the wrong rows.
 *
 *   **Request A must never receive data generated for request B when their
 *   effective filters differ.**
 *
 * So these tests seed the cache through one request and then assert what a
 * *different* request gets back, rather than inspecting keys.
 */

import { OffersService } from '../offers.service';

import type { OfferCardDto } from '../DTO/offer-list.dto';

interface CachedPage {
  data: OfferCardDto[];
  total: number;
  coordinates: Record<string, [number, number]>;
}

/**
 * Cache-aside with a real prefix delete, so invalidation is exercised rather
 * than assumed. `delByPrefix` is `deleteByPattern(client, prefix + '*')` in
 * production, which is what the glob here models.
 */
const makeCache = () => {
  const store = new Map<string, string>();
  const keys: string[] = [];

  return {
    keys,
    store,
    getOrSet: jest.fn(async (key: string, factory: () => Promise<unknown>): Promise<unknown> => {
      keys.push(key);
      const hit = store.get(key);
      if (hit !== undefined) {
        return JSON.parse(hit) as unknown;
      }
      const value = await factory();
      store.set(key, JSON.stringify(value));
      return value;
    }),
    delByPrefix: jest.fn(async (prefix: string): Promise<number> => {
      await Promise.resolve();
      let n = 0;
      for (const k of [...store.keys()]) {
        if (k.startsWith(prefix)) {
          store.delete(k);
          n++;
        }
      }
      return n;
    }),
  };
};

const card = (id: string): OfferCardDto => ({ id, title: `offer-${id}` }) as OfferCardDto;

/**
 * The fetcher answers strictly from the types it is handed, so any row that
 * does not belong to the requested filter can only have come from another
 * request's cache entry.
 */
const buildService = () => {
  const cache = makeCache();

  const fetchExpiring = jest.fn(
    async (_h: number, _p: number, _l: number, types?: readonly string[]) => {
      await Promise.resolve();
      const ids =
        types === undefined ? ['bakery-1', 'cafe-1', 'hotel-1'] : types.map(t => `${t}-1`);
      return { data: ids.map(card), total: ids.length, coordinates: {} } as CachedPage;
    },
  );

  const service = Object.create(OffersService.prototype) as OffersService;
  Object.assign(service, {
    cacheService: cache,
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn(), debug: jest.fn() },
    fetchExpiringOffers: fetchExpiring,
    getUserFavoriteOfferIds: jest.fn().mockResolvedValue([]),
  });

  return { service, cache, fetchExpiring };
};

const ids = (r: { data: OfferCardDto[] }): string[] => r.data.map(d => d.id);

const urgent = async (
  service: OffersService,
  types?: readonly string[] | string,
  userId = 'u',
): Promise<{ data: OfferCardDto[]; total: number }> => {
  // Block body with an awaited local: satisfies `promise-function-async`,
  // `require-await` and `no-return-await` together, which a direct-return
  // arrow cannot.
  const page = await service.getUrgentOffers(1, 1, 10, userId, undefined, types);
  return page;
};

// ============================================================================
// The invariant
// ============================================================================

describe('no cross-filter data leakage', () => {
  it('a bakery request never sees rows warmed by a cafe request', async () => {
    const { service } = buildService();

    await urgent(service, ['cafe']); // warms the cafe entry first
    const bakery = await urgent(service, ['bakery']);

    expect(ids(bakery)).toEqual(['bakery-1']);
    expect(ids(bakery)).not.toContain('cafe-1');
  });

  it('a narrower request never inherits rows from a wider one', async () => {
    const { service } = buildService();

    await urgent(service, ['bakery', 'cafe']);
    const narrow = await urgent(service, ['bakery']);

    expect(ids(narrow)).toEqual(['bakery-1']);
  });

  it('a wider request never inherits rows from a narrower one', async () => {
    const { service } = buildService();

    await urgent(service, ['bakery']);
    const wide = await urgent(service, ['bakery', 'cafe']);

    expect(ids(wide)).toEqual(['bakery-1', 'cafe-1']);
  });

  it('a filtered request never sees the unfiltered page', async () => {
    const { service } = buildService();

    await urgent(service, undefined); // warms the unfiltered entry
    const bakery = await urgent(service, ['bakery']);

    expect(ids(bakery)).toEqual(['bakery-1']);
    expect(ids(bakery)).not.toContain('hotel-1');
  });

  it('an unfiltered request never sees a filtered page', async () => {
    const { service } = buildService();

    await urgent(service, ['bakery']);
    const all = await urgent(service, undefined);

    expect(ids(all)).toEqual(['bakery-1', 'cafe-1', 'hotel-1']);
  });

  it('holds across the whole category set, warmed in sequence', async () => {
    // Every filter warms an entry, then every filter is re-read. Any key
    // collision anywhere in the set shows up as a wrong row here.
    const { service } = buildService();
    const sets = [['bakery'], ['cafe'], ['hotel'], ['supermarket'], ['bakery', 'cafe']];

    for (const s of sets) {
      await urgent(service, s);
    }

    for (const s of sets) {
      expect(ids(await urgent(service, s))).toEqual(s.map(t => `${t}-1`));
    }
  });
});

// ============================================================================
// Equivalence — the other half, asserted on data rather than keys
// ============================================================================

describe('equivalent filters share one entry', () => {
  it.each([
    ['reordered', ['cafe', 'bakery']],
    ['duplicated', ['bakery', 'bakery', 'cafe']],
    ['whitespace-padded', [' bakery ', 'cafe']],
    ['with an unknown value', ['bakery', 'cafe', 'not_a_type']],
    ['comma-joined', 'bakery,cafe'],
  ] as ReadonlyArray<readonly [string, readonly string[] | string]>)(
    '%s input is served from the same entry',
    async (_label, variant) => {
      const { service, fetchExpiring } = buildService();

      const first = await urgent(service, ['bakery', 'cafe']);
      const second = await urgent(service, variant);

      // One fetch total means the second call was a cache hit, not a re-query.
      expect(fetchExpiring).toHaveBeenCalledTimes(1);
      expect(ids(second)).toEqual(ids(first));
    },
  );

  it('treats an all-unknown filter as unfiltered', async () => {
    // The contract is "ignore what the enum does not contain", so a filter made
    // entirely of junk degrades to no filter rather than to an empty result.
    const { service, fetchExpiring } = buildService();

    const none = await urgent(service, undefined);
    const junk = await urgent(service, ['nope', 'also_nope']);

    expect(fetchExpiring).toHaveBeenCalledTimes(1);
    expect(ids(junk)).toEqual(ids(none));
  });

  it('treats an empty array as unfiltered', async () => {
    const { service, fetchExpiring } = buildService();

    await urgent(service, undefined);
    await urgent(service, []);

    expect(fetchExpiring).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Invalidation must reach every variant
// ============================================================================

describe('invalidation clears filtered and unfiltered variants alike', () => {
  /**
   * `invalidateDiscoveryCaches` is private and fire-and-forget; this is the
   * exact prefix it passes for this feed.
   *
   * Awaited here even though production does not await: the purge is async, so
   * asserting the store immediately after firing it would race the delete and
   * pass or fail on timing rather than on behaviour.
   */
  const invalidate = async (service: OffersService): Promise<void> => {
    await (
      service as unknown as { cacheService: { delByPrefix: (p: string) => Promise<number> } }
    ).cacheService.delByPrefix('offers:urgent:');
  };

  it('purges every filtered entry along with the unfiltered one', async () => {
    const { service, cache } = buildService();

    await urgent(service, undefined);
    await urgent(service, ['bakery']);
    await urgent(service, ['cafe', 'hotel']);
    expect(cache.store.size).toBe(3);

    await invalidate(service);

    // A prefix purge that missed the `:types=` suffix would leave stale filtered
    // pages serving deleted offers until TTL.
    expect(cache.store.size).toBe(0);
  });

  it('refetches after invalidation rather than serving a stale page', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await urgent(service, ['bakery']);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);

    await urgent(service, ['bakery']);
    expect(fetchExpiring).toHaveBeenCalledTimes(1); // cache hit

    await invalidate(service);
    await urgent(service, ['bakery']);

    expect(fetchExpiring).toHaveBeenCalledTimes(2);
    expect(cache.store.size).toBe(1);
  });

  it('leaves other feeds alone', async () => {
    // The purge is by prefix, so it must not take `offers:featured:` with it.
    const { service, cache } = buildService();

    await urgent(service, ['bakery']);
    cache.store.set('offers:featured:1:10', '{"data":[],"total":0,"coordinates":{}}');

    await invalidate(service);

    expect([...cache.store.keys()]).toEqual(['offers:featured:1:10']);
  });
});

// ============================================================================
// Sharing must survive the filter
// ============================================================================

describe('the filter does not make the cache per-user', () => {
  it('serves two users one entry for the same filter', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await urgent(service, ['bakery'], 'user-a');
    await urgent(service, ['bakery'], 'user-b');

    expect(fetchExpiring).toHaveBeenCalledTimes(1);
    expect(cache.store.size).toBe(1);
    expect([...cache.store.keys()][0]).not.toContain('user-');
  });
});
