/**
 * `getUrgentOffers` caches a shared page — the establishment filter must be
 * part of what identifies it.
 *
 * WHY
 * ---
 * The key was `offers:urgent:{hours}:{page}:{limit}`, which fully identified
 * the response while the endpoint took no filter. Once it accepts
 * `establishmentTypes`, that key describes several different responses: the
 * first caller warms the entry, and every later caller with a *different*
 * filter is served that page. Nothing errors. The carousel is simply wrong,
 * for everyone except whoever happened to be first.
 *
 * The companion property is determinism. `[bakery,cafe]` and `[cafe,bakery]`
 * are the same query; if they key differently the cache fragments for no gain,
 * and the miss rate climbs with every ordering a client happens to send.
 *
 * `establishment-type-filter.util.spec.ts` pins the key *format* in isolation.
 * This file pins the behaviour through the real service: that distinct filters
 * really do fetch separately and return their own data, and equivalent ones
 * really do share a single fetch.
 */

import { OffersService } from '../offers.service';

import type { OfferCardDto } from '../DTO/offer-list.dto';

interface CachedPage {
  data: OfferCardDto[];
  total: number;
  coordinates: Record<string, [number, number]>;
}

/** Cache-aside with the JSON round-trip a real Redis hit would impose. */
const makeCache = () => {
  const store = new Map<string, string>();
  const keys: string[] = [];

  const getOrSet = jest.fn(
    async (key: string, factory: () => Promise<unknown>): Promise<unknown> => {
      keys.push(key);
      const hit = store.get(key);
      if (hit !== undefined) {
        return JSON.parse(hit) as unknown;
      }
      const value = await factory();
      store.set(key, JSON.stringify(value));
      return value;
    },
  );

  return { keys, getOrSet, store };
};

const card = (id: string): OfferCardDto => ({ id, title: `offer-${id}` }) as OfferCardDto;

const page = (ids: string[]): CachedPage => ({
  data: ids.map(card),
  total: ids.length,
  coordinates: {},
});

/**
 * Builds the service with only the data boundary stubbed. The fetcher answers
 * according to the types it is handed, so "did the right filter reach the
 * database" and "did the right rows come back" are the same assertion.
 */
const buildService = () => {
  const cache = makeCache();

  const fetchExpiring = jest.fn(
    async (_hours: number, _page: number, _limit: number, types?: readonly string[]) => {
      // Yields a microtask so the stub resolves on a later tick like the real
      // aggregation does — and satisfies `require-await` without a disable.
      await Promise.resolve();
      if (types === undefined) {
        return page(['bakery-1', 'cafe-1', 'hotel-1']);
      }
      return page(types.map(t => `${t}-1`));
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

// ============================================================================
// Key shape
// ============================================================================

describe('getUrgentOffers cache key', () => {
  it('is unchanged when no filter is supplied', async () => {
    // Existing warm entries stay valid and prefix invalidation keeps working.
    const { service, cache } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'user-1');

    expect(cache.keys).toEqual(['offers:urgent:1:1:10']);
  });

  it('appends the normalised filter when one is supplied', async () => {
    const { service, cache } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'user-1', undefined, ['cafe', 'bakery']);

    expect(cache.keys).toEqual(['offers:urgent:1:1:10:types=bakery,cafe']);
  });

  it('keeps the offers:urgent: prefix so invalidation still purges it', async () => {
    const { service, cache } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);

    expect(cache.keys[0]).toMatch(/^offers:urgent:/u);
  });
});

// ============================================================================
// Property 1 — different filters must not share an entry
// ============================================================================

describe('different establishmentTypes produce different keys AND results', () => {
  it('does not serve the cafe request from the bakery entry', async () => {
    const { service, cache, fetchExpiring } = buildService();

    const bakery = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);
    const cafe = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['cafe']);

    expect(new Set(cache.keys).size).toBe(2);
    // Two distinct keys means two real fetches, not one page shown twice.
    expect(fetchExpiring).toHaveBeenCalledTimes(2);
    expect(ids(bakery)).toEqual(['bakery-1']);
    expect(ids(cafe)).toEqual(['cafe-1']);
  });

  it('does not serve a subset from its superset', async () => {
    const { service, fetchExpiring } = buildService();

    const both = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery', 'cafe']);
    const one = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);

    expect(fetchExpiring).toHaveBeenCalledTimes(2);
    expect(ids(both)).toEqual(['bakery-1', 'cafe-1']);
    // The narrower request must NOT inherit the cafe row from the wider page.
    expect(ids(one)).toEqual(['bakery-1']);
  });

  it('does not serve a filtered request from the unfiltered entry', async () => {
    const { service, fetchExpiring } = buildService();

    const all = await service.getUrgentOffers(1, 1, 10, 'u');
    const bakery = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);

    expect(fetchExpiring).toHaveBeenCalledTimes(2);
    expect(ids(all)).toHaveLength(3);
    expect(ids(bakery)).toEqual(['bakery-1']);
  });

  it('gives every category its own entry', async () => {
    const { service, cache } = buildService();

    for (const t of ['bakery', 'cafe', 'hotel', 'supermarket', 'wholesaler']) {
      await service.getUrgentOffers(1, 1, 10, 'u', undefined, [t]);
    }

    expect(new Set(cache.keys).size).toBe(5);
  });

  it('passes the normalised types through to the aggregation', async () => {
    // The filter reaching the key but not the query would cache correctly
    // labelled, unfiltered pages — worse than no cache at all.
    const { service, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['cafe', 'bakery', 'bakery']);

    expect(fetchExpiring).toHaveBeenCalledWith(1, 1, 10, ['bakery', 'cafe']);
  });
});

// ============================================================================
// Property 2 — equivalent filters must share one entry
// ============================================================================

describe('equivalent establishmentTypes share one entry', () => {
  it('treats a reordered filter as the same request', async () => {
    const { service, cache, fetchExpiring } = buildService();

    const first = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery', 'cafe']);
    const second = await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['cafe', 'bakery']);

    expect(new Set(cache.keys).size).toBe(1);
    expect(fetchExpiring).toHaveBeenCalledTimes(1); // the second was a cache hit
    expect(ids(second)).toEqual(ids(first));
  });

  it('treats a duplicated filter as the same request', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);
    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery', 'bakery']);

    expect(new Set(cache.keys).size).toBe(1);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);
  });

  it('treats comma-joined and repeated params as the same request', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, 'bakery,cafe');
    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['cafe', 'bakery']);

    expect(new Set(cache.keys).size).toBe(1);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown values instead of keying on them', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);
    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery', 'not_a_type']);

    expect(new Set(cache.keys).size).toBe(1);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);
  });

  it('treats an empty filter as no filter', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u');
    await service.getUrgentOffers(1, 1, 10, 'u', undefined, []);

    expect(cache.keys).toEqual(['offers:urgent:1:1:10', 'offers:urgent:1:1:10']);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// The filter must not undo the sharing the cache exists for
// ============================================================================

describe('the filter does not reintroduce per-user keys', () => {
  it('serves two different users one entry for the same filter', async () => {
    const { service, cache, fetchExpiring } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'user-a', undefined, ['bakery']);
    await service.getUrgentOffers(1, 1, 10, 'user-b', undefined, ['bakery']);

    expect(new Set(cache.keys).size).toBe(1);
    expect(fetchExpiring).toHaveBeenCalledTimes(1);
    expect(cache.keys[0]).not.toContain('user-a');
    expect(cache.keys[0]).not.toContain('user-b');
  });

  it('still separates pages and page sizes under a filter', async () => {
    const { service, cache } = buildService();

    await service.getUrgentOffers(1, 1, 10, 'u', undefined, ['bakery']);
    await service.getUrgentOffers(1, 2, 10, 'u', undefined, ['bakery']);
    await service.getUrgentOffers(1, 1, 20, 'u', undefined, ['bakery']);

    expect(new Set(cache.keys).size).toBe(3);
  });
});
