/**
 * The geo field path `GeozoneService.getStats` queries must exist on the
 * Establishment schema.
 *
 * It did not. The service asked for `location.coordinates`; establishments keep
 * their point at `address.coordinates`, and have no `location` field at all
 * (`location.coordinates` belongs to SearchQuery, a different collection). The
 * query was valid MongoDB, valid TypeScript, and matched zero documents
 * forever, so the admin geozones page showed `establishmentCount: 0` for every
 * zone. That reads as "no merchants here yet", which is why it survived.
 *
 * Nothing could have caught it: a mocked model returns whatever the mock says,
 * and the integration suites are excluded from the default run
 * (`jest.config.js` ignores `*.integration.spec.ts`), so they gate nothing on
 * CI.
 *
 * So this asserts the seam itself: capture the filter the service really
 * builds, then resolve each of its paths against the real Mongoose schema. A
 * path the schema does not define fails here rather than in production silence.
 * This catches any future misspelling in the same query, not just this one.
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import {
  Establishment,
  EstablishmentSchema,
} from '../../../establishments/schemas/establishment.schema';
import { RegexSecurityUtil } from '../../../common/utils/regex-security.util';
import { Geozone } from '../../schemas/geozone.schema';
import { GeozoneService } from '../geozone.service';

const SOUSSE_BOUNDARY = {
  type: 'Polygon' as const,
  // Longitude first, and the ring is closed (last === first) - both are
  // required by MongoDB and both fail silently when wrong.
  coordinates: [
    [
      [10.55, 35.78],
      [10.68, 35.78],
      [10.68, 35.9],
      [10.55, 35.9],
      [10.55, 35.78],
    ],
  ],
};

const ZONE = {
  _id: 'zone-1',
  name: 'grand-sousse',
  displayName: 'Grand Sousse',
  status: 'active',
  center: { latitude: 35.83, longitude: 10.64 },
  boundary: SOUSSE_BOUNDARY,
};

/** Every filter `countDocuments` was called with during the test. */
const capturedFilters: Record<string, unknown>[] = [];

async function buildService(): Promise<GeozoneService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GeozoneService,
      {
        provide: getModelToken(Geozone.name),
        useValue: {
          // `const r = await expr; return r;` - the house pattern. Three lint
          // rules meet on any function returning a promise and only this shape
          // satisfies all three: `promise-function-async` requires `async`,
          // `require-await` requires an `await`, and `no-return-await` forbids
          // `return await expr`.
          find: () => ({
            lean: async () => {
              const zones = await Promise.resolve([ZONE]);
              return zones;
            },
          }),
        },
      },
      {
        provide: getModelToken(Establishment.name),
        useValue: {
          countDocuments: async (filter: Record<string, unknown>) => {
            capturedFilters.push(filter);
            const count = await Promise.resolve(3);
            return count;
          },
        },
      },
      { provide: RegexSecurityUtil, useValue: {} },
    ],
  }).compile();

  return moduleRef.get(GeozoneService);
}

beforeEach(() => {
  capturedFilters.length = 0;
});

describe('GeozoneService.getStats', () => {
  /**
   * Every path carrying a 2dsphere index on the Establishment schema.
   *
   * Read from the schema, not written down here, so it tracks the schema
   * instead of drifting from it.
   */
  const geoIndexedPaths = (): string[] =>
    EstablishmentSchema.indexes()
      .flatMap(([fields]) => Object.entries(fields as Record<string, unknown>))
      .filter(([, type]) => type === '2dsphere')
      .map(([field]) => field);

  it('queries a path that actually carries a 2dsphere index', async () => {
    // The real assertion. `$geoWithin` runs happily without an index and
    // without a matching field - it just returns nothing - so "did it throw"
    // proves nothing here. Demanding the queried path be one the schema
    // geo-indexes rules out both the old typo and any future one.
    const service = await buildService();
    await service.getStats();

    expect(capturedFilters).toHaveLength(1);
    const queriedPaths = Object.keys(capturedFilters[0] as Record<string, unknown>);

    expect(queriedPaths).toEqual(['address.coordinates']);
    for (const path of queriedPaths) {
      expect(geoIndexedPaths()).toContain(path);
    }
  });

  it('rejects the path the bug used', () => {
    // Stated as its own case so the root cause is recorded, not just fixed.
    // Mongoose registers `address` as one nested path, so `.path('address.
    // coordinates')` resolves to undefined for the *correct* path too - which
    // is exactly why a naive "does the schema know this path" check could not
    // tell the two apart, and why the index list is the thing to assert on.
    expect(geoIndexedPaths()).toContain('address.coordinates');
    expect(geoIndexedPaths()).not.toContain('location.coordinates');
  });

  it('has no `location` field at the root, so the old path could never match', () => {
    // If someone later adds a real `location` to Establishment, this fails and
    // the reasoning above gets revisited rather than quietly becoming wrong.
    expect(EstablishmentSchema.path('address')).toBeDefined();
    expect(EstablishmentSchema.path('location')).toBeUndefined();
  });

  it('still returns the per-zone count', async () => {
    const service = await buildService();
    const stats = await service.getStats();

    expect(stats.totalZones).toBe(1);
    expect(stats.activeZones).toBe(1);
    expect(stats.zones[0]?.establishmentCount).toBe(3);
  });
});
