/**
 * Proximity search pipeline shape.
 *
 * These assert the *structure* of the aggregation rather than its results,
 * because the defects being guarded against are structural and invisible in the
 * output — the old pipeline returned correct establishments, it just did an
 * unbounded amount of work to produce them:
 *
 *  - `$geoWithin` uses the 2dsphere index to filter but returns documents
 *    unordered, so the `$sort { distance: 1 }` that followed was a blocking
 *    in-memory sort with no index to satisfy it. MongoDB caps blocking sorts at
 *    100 MB and then fails the query, so a dense enough area did not get slow,
 *    it errored.
 *  - Distance was computed for every document in the radius via aggregation
 *    trigonometry, to return 20 of them.
 *  - On the map endpoint, two `$lookup`s ran for every establishment in the
 *    radius before `$limit` discarded all but 50.
 *
 * `$geoNear` walks the index in distance order and emits `distance` itself, so
 * `$limit` can short-circuit the walk.
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { Establishment } from '../../../establishments/schemas/establishment.schema';
import { Offer } from '../../../offers/schemas/offer.schema';
import { ProximitySearchService } from '../proximity-search.service';

import type { ProximitySearchDto } from '../../dto/geolocation.dto';
import type { TestingModule } from '@nestjs/testing';

type Stage = Record<string, Record<string, unknown>>;

const TUNIS = { latitude: 36.8065, longitude: 10.1815 };

const baseDto = (over: Partial<ProximitySearchDto> = {}): ProximitySearchDto =>
  ({ center: TUNIS, radius: 5000, ...over }) as ProximitySearchDto;

describe('ProximitySearchService — aggregation pipeline shape', () => {
  let service: ProximitySearchService;
  let establishmentModel: { aggregate: jest.Mock };
  let offerModel: { aggregate: jest.Mock };

  /** The pipeline handed to establishmentModel.aggregate on the last call. */
  const capturedPipeline = (): Stage[] => {
    const { calls } = establishmentModel.aggregate.mock;
    return calls[calls.length - 1]?.[0] as Stage[];
  };

  const stageNames = (pipeline: Stage[]): string[] =>
    pipeline.map(stage => Object.keys(stage)[0] ?? '');

  beforeEach(async () => {
    establishmentModel = { aggregate: jest.fn().mockResolvedValue([]) };
    offerModel = { aggregate: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProximitySearchService,
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(Offer.name), useValue: offerModel },
      ],
    }).compile();

    service = module.get(ProximitySearchService);
  });

  describe('searchEstablishments', () => {
    it('puts $geoNear first — MongoDB rejects it anywhere else', async () => {
      await service.searchEstablishments(baseDto());

      expect(stageNames(capturedPipeline())[0]).toBe('$geoNear');
    });

    it('no longer uses $geoWithin / $centerSphere', async () => {
      await service.searchEstablishments(baseDto());

      expect(JSON.stringify(capturedPipeline())).not.toContain('$geoWithin');
      expect(JSON.stringify(capturedPipeline())).not.toContain('$centerSphere');
    });

    it('has no blocking $sort — $geoNear already emits in distance order', async () => {
      // The regression that mattered: an unindexed $sort over the whole radius.
      await service.searchEstablishments(baseDto());

      expect(stageNames(capturedPipeline())).not.toContain('$sort');
    });

    it('does not compute distance itself — $geoNear supplies it', async () => {
      await service.searchEstablishments(baseDto());

      // $degreesToRadians only appeared in the hand-rolled haversine.
      expect(JSON.stringify(capturedPipeline())).not.toContain('$degreesToRadians');
    });

    it('passes the radius as maxDistance in metres, not radians', async () => {
      // $centerSphere took radians; getting the unit wrong here silently
      // searches a radius ~6.4 million times too small.
      await service.searchEstablishments(baseDto({ radius: 5000 }));

      const geoNear = capturedPipeline()[0]?.['$geoNear'];
      expect(geoNear?.['maxDistance']).toBe(5000);
      expect(geoNear?.['spherical']).toBe(true);
    });

    it('names the indexed field via `key`', async () => {
      // Establishment has exactly one 2dsphere index today, but naming it means
      // adding a second geo field later cannot silently repoint the query.
      await service.searchEstablishments(baseDto());

      expect(capturedPipeline()[0]?.['$geoNear']?.['key']).toBe('address.coordinates');
    });

    it('applies non-geo filters inside $geoNear.query, not a trailing $match', async () => {
      // In `query` they run during the index walk, so $limit can stop early.
      // As a later $match they force the index to yield the whole radius first.
      await service.searchEstablishments(baseDto());

      const query = capturedPipeline()[0]?.['$geoNear']?.['query'] as Record<string, unknown>;
      expect(query).toBeDefined();
      expect(query['isActive']).toBe(true);
      expect(query['status']).toBeDefined();
      expect(stageNames(capturedPipeline())).not.toContain('$match');
    });

    it('carries type and rating filters into the same query', async () => {
      await service.searchEstablishments(baseDto(), {
        establishmentTypes: ['restaurant'],
        minRating: 4,
      });

      const query = capturedPipeline()[0]?.['$geoNear']?.['query'] as Record<string, unknown>;
      expect(query['type']).toEqual({ $in: ['restaurant'] });
      expect(query['averageRating']).toEqual({ $gte: 4 });
    });

    it('applies $limit so the index walk can short-circuit', async () => {
      await service.searchEstablishments(baseDto({ limit: 20 } as Partial<ProximitySearchDto>));

      const limitStage = capturedPipeline().find(stage => '$limit' in stage);
      expect(limitStage).toEqual({ $limit: 20 });
    });

    it('omits $skip when no offset is requested', async () => {
      await service.searchEstablishments(baseDto());

      expect(stageNames(capturedPipeline())).not.toContain('$skip');
    });

    it('includes $skip before $limit when paginating', async () => {
      await service.searchEstablishments(baseDto({ skip: 40 } as Partial<ProximitySearchDto>));

      const names = stageNames(capturedPipeline());
      expect(names.indexOf('$skip')).toBeGreaterThan(-1);
      expect(names.indexOf('$skip')).toBeLessThan(names.indexOf('$limit'));
    });

    it('keeps index order even when sortByDistance is false', async () => {
      // "Any order" is satisfied by the order the index already produced;
      // imposing a different one would reintroduce the blocking sort.
      await service.searchEstablishments(
        baseDto({ sortByDistance: false } as Partial<ProximitySearchDto>),
      );

      expect(stageNames(capturedPipeline())).not.toContain('$sort');
    });

    it('rejects an invalid centre before building a pipeline', async () => {
      await expect(
        service.searchEstablishments(baseDto({ center: { latitude: 999, longitude: 0 } })),
      ).rejects.toThrow();

      expect(establishmentModel.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('searchMapEstablishments', () => {
    it('puts $geoNear first', async () => {
      await service.searchMapEstablishments(baseDto());

      expect(stageNames(capturedPipeline())[0]).toBe('$geoNear');
    });

    it('paginates BEFORE the $lookups', async () => {
      // The expensive property on this endpoint. Both joins used to run for
      // every establishment in the radius and only then get discarded by
      // $limit — thousands of joins performed to throw away.
      await service.searchMapEstablishments(baseDto());

      const names = stageNames(capturedPipeline());
      const firstLookup = names.indexOf('$lookup');
      const limit = names.indexOf('$limit');

      expect(firstLookup).toBeGreaterThan(-1);
      expect(limit).toBeGreaterThan(-1);
      expect(limit).toBeLessThan(firstLookup);
    });

    it('still performs both enrichment lookups', async () => {
      // Reordering must not drop them: the map needs merchant image + offers.
      await service.searchMapEstablishments(baseDto());

      const lookups = stageNames(capturedPipeline()).filter(name => name === '$lookup');
      expect(lookups).toHaveLength(2);
    });

    it('has no blocking $sort and no hand-rolled distance', async () => {
      await service.searchMapEstablishments(baseDto());

      expect(stageNames(capturedPipeline())).not.toContain('$sort');
      expect(JSON.stringify(capturedPipeline())).not.toContain('$degreesToRadians');
    });

    it('still derives activeOfferCount after the offers lookup', async () => {
      await service.searchMapEstablishments(baseDto());

      const names = stageNames(capturedPipeline());
      expect(names).toContain('$addFields');
      expect(names.lastIndexOf('$addFields')).toBeGreaterThan(names.indexOf('$lookup'));
      expect(JSON.stringify(capturedPipeline())).toContain('activeOfferCount');
    });

    it('defaults to a 50-document limit', async () => {
      await service.searchMapEstablishments(baseDto());

      const limitStage = capturedPipeline().find(stage => '$limit' in stage);
      expect(limitStage).toEqual({ $limit: 50 });
    });

    it('passes the radius as maxDistance in metres, not radians', async () => {
      // Added after a mutation test survived: the equivalent assertion existed
      // only for searchEstablishments, so dividing this radius by the Earth's
      // radius here went undetected. Metres vs radians is a ~6.4-million-fold
      // error that returns an empty map rather than an exception.
      await service.searchMapEstablishments(baseDto({ radius: 3000 }));

      const geoNear = capturedPipeline()[0]?.['$geoNear'];
      expect(geoNear?.['maxDistance']).toBe(3000);
      expect(geoNear?.['spherical']).toBe(true);
      expect(geoNear?.['key']).toBe('address.coordinates');
    });

    it('applies non-geo filters inside $geoNear.query', async () => {
      await service.searchMapEstablishments(baseDto(), { minRating: 3 });

      const query = capturedPipeline()[0]?.['$geoNear']?.['query'] as Record<string, unknown>;
      expect(query['isActive']).toBe(true);
      expect(query['averageRating']).toEqual({ $gte: 3 });
    });
  });
});
