/**
 * The public endpoints against a real MongoDB replica set.
 *
 * These figures go on the marketing homepage, so "roughly right" is not a
 * standard they can be held to — a rounded-up rescue count on a food-waste site
 * is the one number the audience will check. Every total here is asserted
 * against a fixture whose answer is known by construction.
 *
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import { EstablishmentStatus, OrderStatus, UserRole } from '@foodwaste/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { GeozoneSchema, GeozoneStatus } from '../../admin/schemas/geozone.schema';
import { BAG_IMPACT } from '../../analytics/constants/sustainability.constants';
import { PublicService } from '../public.service';
import {
  WaitlistAudience,
  WaitlistEntrySchema,
  type WaitlistEntryDocument,
} from '../../waitlist/schemas/waitlist-entry.schema';

const MONGO_URI =
  process.env['MONGO_TEST_URI'] ??
  'mongodb://admin:password123@localhost:27017/admin?replicaSet=rs0&directConnection=true';

/** Cache-aside that actually stores, so a stale read would be caught. */
const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    store,
    getOrSet: jest.fn(async (key: string, factory: () => Promise<unknown>) => {
      if (store.has(key)) {
        return store.get(key);
      }
      const value = await factory();
      store.set(key, value);
      return value;
    }),
    del: jest.fn(async (key: string) => {
      await Promise.resolve(store.delete(key));
    }),
  };
};

const oid = () => new Types.ObjectId();

/**
 * The real `WaitlistService` pulls in the email module, which has no business
 * in a data test. Only the three methods `PublicService` calls are stood up,
 * and each runs the same query the real one does against the same collection.
 */
const makeWaitlistService = (model: Model<WaitlistEntryDocument>) => ({
  joinCity: async (email: string, zone: string, audience: WaitlistAudience) => {
    await model
      .updateOne(
        { email: email.toLowerCase().trim(), zone: zone.trim() },
        { $setOnInsert: { audience, source: 'rollout_map' } },
        { upsert: true },
      )
      .exec();
  },
  countByZone: async () => {
    const rows = await model
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: { zone: { $exists: true, $ne: null } } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map(r => [r._id, r.count]));
  },
  totalWaiting: async () => {
    const total = await model.estimatedDocumentCount().exec();
    return total;
  },
});

/**
 * A real closed ring. The geozone schema carries a 2dsphere index on
 * `boundary`, so MongoDB rejects a degenerate polygon at insert time — a
 * constraint no mocked model would ever have surfaced.
 */
const square = (lng: number, lat: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [lng, lat],
      [lng + 0.2, lat],
      [lng + 0.2, lat + 0.2],
      [lng, lat + 0.2],
      [lng, lat],
    ],
  ],
});

describe('PublicService — against a real MongoDB', () => {
  let connection: Connection;
  let service: PublicService;
  let cache: ReturnType<typeof makeCache>;

  const sousseEst = oid();
  const monastirEst = oid();
  const unapprovedEst = oid();
  const outsideEst = oid();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `public_integration_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    const geozoneModel = connection.model('Geozone', GeozoneSchema);
    const waitlistModel = connection.model('CityWaitlistEntry', WaitlistEntrySchema);
    await waitlistModel.syncIndexes();

    const orders = connection.collection('orders');
    const establishments = connection.collection('establishments');
    const users = connection.collection('users');

    // Placed by coordinate. The city strings are deliberately inconsistent —
    // an accent, a suffix, an Arabic name — because attribution must not depend
    // on them, and did until it was moved onto the geometry.
    const at = (lng: number, lat: number) => ({
      type: 'Point' as const,
      coordinates: [lng, lat],
    });

    await establishments.insertMany([
      {
        _id: sousseEst,
        status: EstablishmentStatus.ACTIVE,
        address: { city: 'Sousse Ville', coordinates: at(10.6084, 35.8256) },
      },
      {
        _id: monastirEst,
        status: EstablishmentStatus.ACTIVE,
        address: { city: 'المنستير', coordinates: at(10.8113, 35.7643) },
      },
      // Inside Sousse, but not approved: not a partner and its bags do not count.
      {
        _id: unapprovedEst,
        status: EstablishmentStatus.PENDING,
        address: { city: 'Sousse', coordinates: at(10.61, 35.82) },
      },
      // A real shop in a city we have not opened. Its bags belong to the platform
      // total and to no zone.
      {
        _id: outsideEst,
        status: EstablishmentStatus.ACTIVE,
        address: { city: 'Bizerte', coordinates: at(9.8739, 37.2744) },
      },
    ]);

    await users.insertMany([
      { _id: oid(), role: UserRole.CONSUMER },
      { _id: oid(), role: UserRole.CONSUMER },
      { _id: oid(), role: UserRole.CONSUMER },
      // Merchants and admins are not "people eating better for less".
      { _id: oid(), role: UserRole.MERCHANT },
      { _id: oid(), role: UserRole.ADMIN },
    ]);

    const order = (establishmentId: Types.ObjectId, status: OrderStatus, quantity: number) => ({
      _id: oid(),
      establishmentId,
      status,
      items: [{ offerId: oid(), quantity }],
    });

    await orders.insertMany([
      // Sousse: 5 + 3 bags actually collected.
      order(sousseEst, OrderStatus.PICKED_UP, 5),
      order(sousseEst, OrderStatus.COMPLETED, 3),
      // Monastir: 2 delivered.
      order(monastirEst, OrderStatus.DELIVERED, 2),
      // Inside Sousse but unapproved, and outside every zone: both count towards
      // the platform total and towards no city.
      order(unapprovedEst, OrderStatus.PICKED_UP, 7),
      order(outsideEst, OrderStatus.PICKED_UP, 4),
      // None of these reached anyone, so none of them is a rescued bag.
      order(sousseEst, OrderStatus.CANCELLED, 100),
      order(sousseEst, OrderStatus.EXPIRED, 100),
      order(sousseEst, OrderStatus.PENDING, 100),
      order(sousseEst, OrderStatus.CONFIRMED, 100),
    ]);

    await geozoneModel.insertMany([
      {
        name: 'Sousse',
        displayName: 'Sousse',
        status: GeozoneStatus.ACTIVE,
        boundary: square(10.5, 35.7),
        center: { latitude: 35.8, longitude: 10.6 },
        launchedAt: new Date('2026-03-01T00:00:00Z'),
      },
      {
        name: 'Monastir',
        displayName: 'Monastir',
        status: GeozoneStatus.COMING_SOON,
        foundingTarget: 50,
        foundingSignedCount: 34,
        boundary: square(10.7, 35.6),
        center: { latitude: 35.7, longitude: 10.8 },
      },
      {
        name: 'Gabes',
        displayName: 'Gabès',
        status: GeozoneStatus.COMING_SOON,
        foundingTarget: 0,
        boundary: square(10.0, 33.8),
        center: { latitude: 33.88, longitude: 10.09 },
      },
      {
        name: 'Mahdia',
        displayName: 'Mahdia',
        status: GeozoneStatus.INACTIVE,
        boundary: square(10.9, 35.4),
        center: { latitude: 35.5, longitude: 11.0 },
      },
    ]);

    cache = makeCache();
    service = Object.create(PublicService.prototype) as PublicService;
    Object.assign(service, {
      orderModel: connection.model(
        'Order',
        new mongoose.Schema({}, { strict: false, collection: 'orders' }),
      ),
      establishmentModel: connection.model(
        'Establishment',
        new mongoose.Schema({}, { strict: false, collection: 'establishments' }),
      ),
      userModel: connection.model(
        'User',
        new mongoose.Schema({}, { strict: false, collection: 'users' }),
      ),
      geozoneModel,
      cacheService: cache,
      waitlistService: makeWaitlistService(
        waitlistModel as unknown as Model<WaitlistEntryDocument>,
      ),
    });
  });

  afterAll(async () => {
    await connection?.dropDatabase();
    await connection?.close();
  });

  afterEach(() => cache.store.clear());

  describe('impact totals', () => {
    it('counts only bags that actually reached a person', async () => {
      const impact = await service.getImpact();
      // 5 + 3 + 2 inside zones, plus 7 unapproved and 4 outside every zone. The
      // platform total counts food that reached a person, wherever it happened —
      // only the per-zone breakdown cares about geography. The four unfulfilled
      // orders carry 100 bags each so their inclusion would be unmissable.
      expect(impact.bagsRescued).toBe(21);
    });

    it('counts only approved establishments as partners', async () => {
      // Sousse, Monastir and Bizerte are active; the pending one is not.
      expect((await service.getImpact()).partners).toBe(3);
    });

    it('counts consumers, not every account', async () => {
      expect((await service.getImpact()).people).toBe(3);
    });

    it('derives CO₂ and meals from the shared ADEME coefficients', async () => {
      const impact = await service.getImpact();
      const foodKg = 21 * BAG_IMPACT.avgKgPerBag;

      expect(impact.carbonAvoidedKg).toBe(Math.round(foodKg * BAG_IMPACT.carbonPerKg));
      expect(impact.mealsRescued).toBe(Math.round(foodKg * BAG_IMPACT.mealsPerKg));
    });

    it('reports how many cities are live', async () => {
      expect((await service.getImpact()).citiesLive).toBe(1);
    });

    it('serves every visitor the same cached entry', async () => {
      await service.getImpact();
      await service.getImpact();

      expect(cache.getOrSet).toHaveBeenCalled();
      // One key, no viewer in it — the caching rule this codebase already
      // learned the hard way on offer pages.
      expect([...cache.store.keys()]).toEqual(['public:impact:v1']);
    });
  });

  describe('the rollout map', () => {
    it('hides queued zones that admin has not published', async () => {
      const zones = await service.getZones();
      expect(zones.map(z => z.name)).not.toContain('Mahdia');
    });

    it('puts the live city first and the unlocking one second', async () => {
      const zones = await service.getZones();

      // Gabès is announced with no campaign and sorts before Monastir by name.
      // The city carrying a founding target is the one opening next, so it has
      // to come second regardless — this ordering shipped wrong once, with the
      // panel claiming Gabès was next and showing no meter.
      expect(zones.map(z => z.name)).toEqual(['Sousse', 'Monastir', 'Gabes']);
    });

    it('ranks announced cities without a campaign by demand', async () => {
      await service.joinWaitlist('demand@example.tn', 'Gabes', WaitlistAudience.CONSUMER);

      const zones = await service.getZones();
      const gabes = zones.find(z => z.name === 'Gabes');
      expect(gabes?.peopleWaiting).toBe(1);
      // Still third: a waiting count never overtakes the city with the campaign.
      expect(zones.map(z => z.name)).toEqual(['Sousse', 'Monastir', 'Gabes']);
    });

    it('carries the unlock counter for the city opening next', async () => {
      const monastir = (await service.getZones()).find(z => z.name === 'Monastir');
      expect(monastir?.foundingTarget).toBe(50);
      expect(monastir?.foundingSigned).toBe(34);
    });

    it('attributes rescued bags by geography, not by city spelling', async () => {
      const zones = await service.getZones();

      // The Sousse shop is filed as "Sousse Ville" and the Monastir one under its
      // Arabic name. Neither string equals its zone name; both fall inside the
      // polygon, which is the only thing that should matter.
      expect(zones.find(z => z.name === 'Sousse')?.bagsRescued).toBe(8);
      expect(zones.find(z => z.name === 'Monastir')?.bagsRescued).toBe(2);
    });

    it('attributes nothing to a zone for shops outside it', async () => {
      const zones = await service.getZones();
      const attributed = zones.reduce((sum, zone) => sum + zone.bagsRescued, 0);

      // 21 rescued platform-wide, 10 of them inside a zone. The 7 unapproved and
      // 4 out-of-zone bags belong to no city — we have not opened there, and
      // saying otherwise would be the more flattering lie.
      expect(attributed).toBe(10);
    });

    it('counts partners from the shops actually inside the zone', async () => {
      const zones = await service.getZones();

      // One approved shop each. The pending shop sits inside Sousse and is not a
      // partner; the Bizerte shop is approved and belongs to no zone.
      expect(zones.find(z => z.name === 'Sousse')?.partners).toBe(1);
      expect(zones.find(z => z.name === 'Monastir')?.partners).toBe(1);
      expect(zones.find(z => z.name === 'Gabes')?.partners).toBe(0);
    });

    it('reports the launch date of a live city and null for one not yet open', async () => {
      const zones = await service.getZones();
      expect(zones.find(z => z.name === 'Sousse')?.launchedAt).toBe('2026-03-01T00:00:00.000Z');
      expect(zones.find(z => z.name === 'Monastir')?.launchedAt).toBeNull();
    });
  });

  describe('the waiting list', () => {
    it('records a sign-up and counts it against the city', async () => {
      await service.joinWaitlist('amine@example.tn', 'Monastir', WaitlistAudience.CONSUMER);

      const monastir = (await service.getZones()).find(z => z.name === 'Monastir');
      expect(monastir?.peopleWaiting).toBe(1);
    });

    it('treats a repeat sign-up as success without double-counting', async () => {
      await service.joinWaitlist('repeat@example.tn', 'Monastir', WaitlistAudience.CONSUMER);
      await expect(
        service.joinWaitlist('repeat@example.tn', 'Monastir', WaitlistAudience.CONSUMER),
      ).resolves.toBeUndefined();

      const monastir = (await service.getZones()).find(z => z.name === 'Monastir');
      expect(monastir?.peopleWaiting).toBe(2); // amine + repeat, counted once each
    });

    it('normalises case and whitespace so one person is one row', async () => {
      await service.joinWaitlist('  MiXeD@Example.TN ', 'Monastir', WaitlistAudience.MERCHANT);
      await service.joinWaitlist('mixed@example.tn', 'Monastir', WaitlistAudience.CONSUMER);

      const monastir = (await service.getZones()).find(z => z.name === 'Monastir');
      expect(monastir?.peopleWaiting).toBe(3);
    });

    it('drops the cached map so the next visitor sees the new ranking', async () => {
      await service.getZones();
      expect(cache.store.has('public:zones:v1')).toBe(true);

      await service.joinWaitlist('fresh@example.tn', 'Monastir', WaitlistAudience.CONSUMER);
      expect(cache.store.has('public:zones:v1')).toBe(false);
    });
  });
});
