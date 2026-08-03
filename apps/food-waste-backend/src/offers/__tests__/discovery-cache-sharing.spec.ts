/**
 * The discovery cache must be shared, not per-user.
 *
 * `getFeaturedOffers` and `getUrgentOffers` used to build their cache key from
 * the caller's `userId`, because the cards carry `isFavorite`. That turns a
 * cache into 50,000 private caches: a session is "open the app, browse, leave",
 * which ends long before a 60–120s TTL can be reused, so nearly every home
 * screen ran the full `$lookup` aggregation anyway — while Redis filled with
 * near-identical copies and every offer mutation's prefix purge had to SCAN all
 * of them.
 *
 * `getUrgentOffers` additionally returned early whenever a location was given,
 * on the stated grounds that "location-based results vary per user". They do
 * not: the pipeline neither filters nor sorts on location, so only the
 * decorated `distance` differed. That early return meant the main path the
 * mobile app takes was never cached at all.
 *
 * These tests pin the shape that fixes both: one entry per (page, limit),
 * personalised in process.
 */

import { OffersService } from '../offers.service';

import type { OfferCardDto } from '../DTO/offer-list.dto';

interface CachedPage {
  data: OfferCardDto[];
  total: number;
  coordinates: Record<string, [number, number]>;
}

/**
 * Cache-aside with the real service's JSON round-trip on a hit, so a test
 * cannot accidentally pass by sharing object identity that Redis would not.
 */
const makeCache = (): {
  keys: string[];
  getOrSet: jest.Mock;
} => {
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

  return { keys, getOrSet };
};

/** Minimal card — only the fields these tests read. */
const card = (id: string): OfferCardDto => ({ id, title: `offer-${id}` }) as OfferCardDto;

interface Harness {
  service: OffersService;
  cache: ReturnType<typeof makeCache>;
  fetchFeatured: jest.Mock;
  fetchExpiring: jest.Mock;
  favoriteIds: jest.Mock;
}

/**
 * `Object.create` on the real prototype so the caching and personalisation
 * logic under test is the real code. Only the two data boundaries are stubbed:
 * the aggregation fetchers and the favourites lookup.
 */
const buildService = (page?: Partial<CachedPage>): Harness => {
  const cache = makeCache();

  const cachedPage: CachedPage = {
    data: page?.data ?? [card('a'), card('b')],
    total: page?.total ?? 2,
    coordinates: page?.coordinates ?? { a: [10, 36], b: [10.5, 36.5] },
  };

  const fetchFeatured = jest.fn().mockResolvedValue(cachedPage);
  const fetchExpiring = jest.fn().mockResolvedValue(cachedPage);
  const favoriteIds = jest.fn().mockResolvedValue([]);

  const service = Object.create(OffersService.prototype) as OffersService;
  Object.assign(service, {
    cacheService: cache,
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn(), debug: jest.fn() },
    fetchFeaturedOffers: fetchFeatured,
    fetchExpiringOffers: fetchExpiring,
    getUserFavoriteOfferIds: favoriteIds,
  });

  return { service, cache, fetchFeatured, fetchExpiring, favoriteIds };
};

describe('OffersService — discovery cache is shared across users', () => {
  describe('cache key', () => {
    it('does not contain the caller identity', async () => {
      // The whole defect in one assertion.
      const { service, cache } = buildService();

      await service.getFeaturedOffers(1, 10, 'user-123');

      expect(cache.keys).toEqual(['offers:featured:1:10']);
      expect(cache.keys[0]).not.toContain('user-123');
    });

    it('keeps the prefix that invalidateDiscoveryCaches purges', async () => {
      // Invalidation is `delByPrefix('offers:featured:' | 'offers:urgent:')`.
      // A key shape that drifts off those prefixes would leave discovery lists
      // stale until TTL, with nothing failing to say so.
      const { service, cache } = buildService();

      await service.getFeaturedOffers(2, 20, 'user-1');
      await service.getUrgentOffers(1, 1, 10, 'user-1');

      expect(cache.keys[0]).toMatch(/^offers:featured:/);
      expect(cache.keys[1]).toMatch(/^offers:urgent:/);
    });

    it('still separates distinct pages and page sizes', async () => {
      // Sharing must not go so far as to serve page 2 from page 1's entry.
      const { service, cache } = buildService();

      await service.getFeaturedOffers(1, 10);
      await service.getFeaturedOffers(2, 10);
      await service.getFeaturedOffers(1, 20);

      expect(new Set(cache.keys).size).toBe(3);
    });

    it('caps the cached page size the same way the query does', async () => {
      // The key must reflect the *effective* limit. Keying on the raw request
      // would mint a distinct entry per absurd limit — an unbounded, trivially
      // attacker-driven key space in front of the most expensive query here.
      const { service, cache } = buildService();

      await service.getFeaturedOffers(1, 5000);

      expect(cache.keys).toEqual(['offers:featured:1:100']);
    });
  });

  describe('sharing', () => {
    it('runs the aggregation once for two different users', async () => {
      const { service, fetchFeatured } = buildService();

      await service.getFeaturedOffers(1, 10, 'user-1');
      await service.getFeaturedOffers(1, 10, 'user-2');

      expect(fetchFeatured).toHaveBeenCalledTimes(1);
    });

    it('serves an authenticated and an anonymous caller from one entry', async () => {
      const { service, fetchFeatured } = buildService();

      await service.getFeaturedOffers(1, 10, 'user-1');
      await service.getFeaturedOffers(1, 10);

      expect(fetchFeatured).toHaveBeenCalledTimes(1);
    });

    it('caches the location-aware urgent list instead of bypassing', async () => {
      // The regression that mattered most: this path is what the mobile home
      // screen calls, and it used to return before reaching the cache.
      const { service, fetchExpiring } = buildService();

      await service.getUrgentOffers(1, 1, 10, 'user-1', { latitude: 36, longitude: 10 });
      await service.getUrgentOffers(1, 1, 10, 'user-2', { latitude: 35, longitude: 9 });

      expect(fetchExpiring).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-viewer personalisation', () => {
    it('marks only the offers this user favourited', async () => {
      const { service, favoriteIds } = buildService();
      favoriteIds.mockResolvedValue(['a']);

      const result = await service.getFeaturedOffers(1, 10, 'user-1');

      expect(result.data.map(o => o.isFavorite)).toEqual([true, false]);
    });

    it('gives each user their own favourites from the one shared page', async () => {
      const { service, favoriteIds } = buildService();

      favoriteIds.mockResolvedValueOnce(['a', 'b']);
      const first = await service.getFeaturedOffers(1, 10, 'user-1');

      favoriteIds.mockResolvedValueOnce([]);
      const second = await service.getFeaturedOffers(1, 10, 'user-2');

      expect(first.data.map(o => o.isFavorite)).toEqual([true, true]);
      expect(second.data.map(o => o.isFavorite)).toEqual([false, false]);
    });

    it('does not modify the page it personalises', async () => {
      /*
       * Asserted on the input directly rather than through two sequential
       * requests, because no cache shape reachable from here can show the
       * consequence: `CacheService.set()` snapshots the value before
       * personalisation runs, and both a hit and a miss yield a fresh object.
       *
       * The property still has to hold. The moment anything holds a page in
       * process — an LRU in front of Redis, or single-flight coalescing of
       * concurrent misses — personalising in place would write this user's
       * hearts into the copy served to everyone else. This is the assertion
       * that stops that from being introduced silently.
       */
      const { service } = buildService();
      const page: CachedPage = {
        data: [card('a'), card('b')],
        total: 2,
        coordinates: { a: [10, 36], b: [10.5, 36.5] },
      };

      const personalize = (
        service as unknown as {
          personalizeOfferPage: (
            p: CachedPage,
            userId?: string,
            loc?: { latitude: number; longitude: number },
          ) => Promise<{ data: OfferCardDto[]; total: number }>;
        }
      ).personalizeOfferPage.bind(service);

      const result = await personalize(page, 'user-1', { latitude: 36, longitude: 10 });

      // The returned cards carry the overlays...
      expect(result.data[0]).toMatchObject({ isFavorite: false, distance: 0 });
      // ...and the page it read from carries none of them.
      expect(page.data[0]?.isFavorite).toBeUndefined();
      expect(page.data[0]?.distance).toBeUndefined();
      expect(page.data[1]?.isFavorite).toBeUndefined();
    });

    it('leaves isFavorite unset for an anonymous caller', async () => {
      // Unset, not false: `false` asserts "you have not favourited this", which
      // is a claim the server cannot make about a viewer it cannot identify.
      const { service, favoriteIds } = buildService();

      const result = await service.getFeaturedOffers(1, 10);

      expect(result.data.every(o => o.isFavorite === undefined)).toBe(true);
      expect(favoriteIds).not.toHaveBeenCalled();
    });

    it('still serves the list when the favourites lookup fails', async () => {
      // A favourites outage must cost the hearts, not the home screen.
      const { service, favoriteIds } = buildService();
      favoriteIds.mockRejectedValue(new Error('favorites unavailable'));

      const result = await service.getFeaturedOffers(1, 10, 'user-1');

      expect(result.data).toHaveLength(2);
      expect(result.data.every(o => o.isFavorite === false)).toBe(true);
    });

    it('preserves the shared total', async () => {
      const { service } = buildService({ total: 47 });

      const result = await service.getFeaturedOffers(1, 10, 'user-1');

      expect(result.total).toBe(47);
    });
  });

  describe('distance', () => {
    it('computes a different distance per viewer from one cached page', async () => {
      const { service } = buildService();

      const near = await service.getUrgentOffers(1, 1, 10, undefined, {
        latitude: 36,
        longitude: 10,
      });
      const far = await service.getUrgentOffers(1, 1, 10, undefined, {
        latitude: 34,
        longitude: 8,
      });

      // Offer 'a' sits exactly at the first viewer's coordinates.
      expect(near.data[0]?.distance).toBe(0);
      expect(far.data[0]?.distance).toBeGreaterThan(0);
    });

    it('leaves distance unset when the caller sent no location', async () => {
      const { service } = buildService();

      const result = await service.getUrgentOffers(1, 1, 10, 'user-1');

      expect(result.data.every(o => o.distance === undefined)).toBe(true);
    });

    it('leaves distance unset for an offer with no coordinates', async () => {
      /*
       * Rather than defaulting to 0. An establishment with no geocoded address
       * would otherwise be reported as being exactly at the user's feet, and
       * sort ahead of every genuinely nearby offer.
       */
      const { service } = buildService({
        data: [card('a'), card('no-coords')],
        total: 2,
        coordinates: { a: [10, 36] },
      });

      const result = await service.getUrgentOffers(1, 1, 10, undefined, {
        latitude: 36,
        longitude: 10,
      });

      expect(result.data[0]?.distance).toBe(0);
      expect(result.data[1]?.distance).toBeUndefined();
    });

    it('applies favourites and distance together', async () => {
      // Both overlays run over the same copied card; one must not drop the other.
      const { service, favoriteIds } = buildService();
      favoriteIds.mockResolvedValue(['b']);

      const result = await service.getUrgentOffers(1, 1, 10, 'user-1', {
        latitude: 36,
        longitude: 10,
      });

      expect(result.data[0]).toMatchObject({ id: 'a', isFavorite: false, distance: 0 });
      expect(result.data[1]?.isFavorite).toBe(true);
      expect(result.data[1]?.distance).toBeGreaterThan(0);
    });
  });
});
