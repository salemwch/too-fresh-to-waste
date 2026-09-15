/**
 * `findAll` must resolve its sort BEFORE the establishment-filter branch.
 *
 * WHAT THIS CAUGHT
 * ----------------
 * `sort` was declared empty near the top of `findAll` and only populated ~400
 * lines later, just above the default pipeline. The establishment-filter branch
 * sits between those two points and builds its own aggregation ending in
 * `{ $sort: sort }` — so it always emitted `$sort: {}`, which MongoDB rejects:
 *
 *     HTTP 500 — "$sort stage must have at least one sort key"
 *
 * Every filtered `/offers` request **without** `latitude`/`longitude` failed.
 * The geo branch was unaffected because `$geoNear` supplies its own ordering,
 * and the mobile app always sends coordinates — so the whole class of failure
 * was invisible from the app and looked like "returns nothing" from a client
 * that swallowed the error body.
 *
 * `/offers` genuinely permits requests without coordinates (the unfiltered form
 * works and is used by tooling), so the contract is "coordinates are optional"
 * and the fix is to resolve the sort once, for both branches. Resolving it in
 * one place also guarantees the two branches order results identically, which
 * is what callers actually depend on.
 *
 * These tests assert the pipeline the service hands to Mongo, because that is
 * the seam that was wrong. Asserting "findAll returns rows" would pass against
 * the broken version for the geo path and tell us nothing about the other.
 */

import { OffersService } from '../offers.service';

import type { PipelineStage } from 'mongoose';

/** Every aggregation pipeline the service built during a call. */
const captured: PipelineStage[][] = [];

const buildService = () => {
  captured.length = 0;

  const aggregate = jest.fn((pipeline: PipelineStage[]) => {
    captured.push(pipeline);
    return { exec: jest.fn().mockResolvedValue([]) };
  });

  const service = Object.create(OffersService.prototype) as OffersService;
  Object.assign(service, {
    offerModel: {
      aggregate,
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
    },
    cacheService: { getOrSet: jest.fn(), delByPrefix: jest.fn() },
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn(), debug: jest.fn() },
    mapOffersToDto: jest.fn().mockResolvedValue([]),
    getUserFavoriteOfferIds: jest.fn().mockResolvedValue([]),
  });

  return { service };
};

/** Every `$sort` stage across every pipeline built during the call. */
const sortStages = (): Record<string, unknown>[] =>
  captured
    .flat()
    .filter(s => '$sort' in s)
    .map(s => (s as unknown as { $sort: Record<string, unknown> }).$sort);

describe('findAll resolves the sort for every branch', () => {
  it('never emits an empty $sort when filtering without coordinates', async () => {
    // The exact request that returned HTTP 500.
    const { service } = buildService();

    await service.findAll(1, 10, { establishmentTypes: ['bakery', 'pastry_shop'] } as never);

    const sorts = sortStages();
    expect(sorts.length).toBeGreaterThan(0);
    for (const s of sorts) {
      // MongoDB rejects `$sort: {}` outright — this is the regression.
      expect(Object.keys(s).length).toBeGreaterThan(0);
    }
  });

  it('defaults to newest-first when no sortBy is given', async () => {
    const { service } = buildService();

    await service.findAll(1, 10, { establishmentTypes: ['bakery'] } as never);

    expect(sortStages()[0]).toEqual({ createdAt: -1 });
  });

  it('honours an explicit sortBy on the filtered branch', async () => {
    const { service } = buildService();

    await service.findAll(1, 10, {
      establishmentTypes: ['bakery'],
      sortBy: 'pricing.discountedPrice',
      sortOrder: 'asc',
    } as never);

    expect(sortStages()[0]).toEqual({ 'pricing.discountedPrice': 1 });
  });

  it('gives the unfiltered branch the same default sort', async () => {
    // Both branches must order identically; a caller adding a filter should not
    // silently get a different ordering.
    const { service } = buildService();

    await service.findAll(1, 10, {} as never);

    expect(sortStages()[0]).toEqual({ createdAt: -1 });
  });

  it('applies the establishment filter on the non-geo branch', async () => {
    // Guards the other half: the sort fix must not have moved the branch off
    // the filter it exists for.
    const { service } = buildService();

    await service.findAll(1, 10, { establishmentTypes: ['bakery', 'pastry_shop'] } as never);

    const matches = captured
      .flat()
      .filter(s => '$match' in s)
      .map(s => (s as unknown as { $match: Record<string, unknown> }).$match);

    expect(matches.some(m => JSON.stringify(m).includes('establishment.type'))).toBe(true);
  });
});
