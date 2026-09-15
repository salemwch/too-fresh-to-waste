/**
 * Executes the pricing aggregations against a real MongoDB replica set.
 *
 * The unit spec next to this one mocks `offerModel.aggregate`, so it asserts
 * the *shape* of the pipeline and nothing about whether MongoDB accepts it or
 * computes what we think it computes. Everything below is precisely what a
 * shape assertion cannot reach:
 *
 *  - `$facet` with five sub-pipelines over one `$match`
 *  - `$lookup` carrying both `localField`/`foreignField` and a `pipeline`
 *  - `$dayOfWeek` / `$hour` with an explicit `timezone`, which is the whole
 *    point of the Africa/Tunis fix — a UTC bucket and a Tunis bucket are
 *    deliberately made to disagree here, and the assertion picks the Tunis one
 *  - `$in` used as an aggregation *expression* inside `$cond`, which is a
 *    different operator from the `$in` query form and fails differently
 *
 * Requires the local stack:
 *
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 *
 * There is no skip path. A missing database fails this suite loudly, because a
 * suite that skips itself when the dependency is absent reports green while
 * proving nothing.
 */

import { EstablishmentType } from '@foodwaste/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { OffersService } from '../offers.service';
import { OfferSchema, OfferStatus, type OfferDocument } from '../schemas/offer.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';

const MONGO_URI = requireMongoTestUri();

const TIMEZONE = 'Africa/Tunis';
const DAY_MS = 24 * 60 * 60 * 1000;

const CITY = 'Tunis';
const OTHER_CITY = 'Sfax';

/** Weekday index (0 = Sunday) of an instant, in a given timezone. */
const weekdayIn = (date: Date, timeZone: string): number => {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
};

/** Hour of an instant, in a given timezone. */
const hourIn = (date: Date, timeZone: string): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(date),
  );

interface OfferFixture {
  merchantId: Types.ObjectId;
  establishmentId: Types.ObjectId;
  status: OfferStatus;
  originalPrice: number;
  discountedPrice: number;
  totalQuantity: number;
  soldQuantity: number;
  createdAt: Date;
  publishedAt?: Date;
}

const offerDoc = (f: OfferFixture) => ({
  _id: new Types.ObjectId(),
  title: 'Integration fixture bag',
  description: 'A fixture offer used by the pricing aggregation integration suite.',
  merchantId: f.merchantId,
  establishmentId: f.establishmentId,
  type: 'surprise_bag',
  status: f.status,
  pricing: {
    originalPrice: f.originalPrice,
    discountedPrice: f.discountedPrice,
    discountPercentage: Math.round((1 - f.discountedPrice / f.originalPrice) * 100),
    currency: 'TND',
  },
  totalQuantity: f.totalQuantity,
  soldQuantity: f.soldQuantity,
  reservedQuantity: 0,
  createdAt: f.createdAt,
  updatedAt: f.createdAt,
  ...(f.publishedAt ? { publishedAt: f.publishedAt } : {}),
});

describe('OffersService — pricing aggregations against a real MongoDB', () => {
  let connection: Connection;
  let offerModel: Model<OfferDocument>;
  let service: OffersService;

  const merchantId = new Types.ObjectId();
  const merchantEstablishmentId = new Types.ObjectId();

  /** 23:30 UTC is 00:30 the following day in Tunis — the two buckets disagree. */
  const crossesMidnightInTunis = (() => {
    const d = new Date(Date.now() - 5 * DAY_MS);
    d.setUTCHours(23, 30, 0, 0);
    return d;
  })();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `pricing_integration_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    // Mongoose types the compiled model against the raw `Offer` class while
    // the service consumes `Model<OfferDocument>`; the runtime object is the
    // same one either way.
    offerModel = connection.model('Offer', OfferSchema) as unknown as Model<OfferDocument>;

    const establishments = connection.collection('establishments');
    const offers = offerModel.collection;

    // Three peer pastry shops in the same city, one restaurant in the same city
    // (must not be averaged in), one pastry shop in another city (must not be
    // averaged in), plus the merchant's own establishment.
    const peerA = new Types.ObjectId();
    const peerB = new Types.ObjectId();
    const peerC = new Types.ObjectId();
    const restaurant = new Types.ObjectId();
    const otherCityPastry = new Types.ObjectId();

    await establishments.insertMany([
      {
        _id: merchantEstablishmentId,
        address: { city: CITY },
        type: EstablishmentType.PASTRY_SHOP,
      },
      { _id: peerA, address: { city: CITY }, type: EstablishmentType.PASTRY_SHOP },
      { _id: peerB, address: { city: CITY }, type: EstablishmentType.PASTRY_SHOP },
      { _id: peerC, address: { city: CITY }, type: EstablishmentType.PASTRY_SHOP },
      { _id: restaurant, address: { city: CITY }, type: EstablishmentType.RESTAURANT },
      {
        _id: otherCityPastry,
        address: { city: OTHER_CITY },
        type: EstablishmentType.PASTRY_SHOP,
      },
    ]);

    /** Pinned to 08:00 UTC (09:00 Tunis) so no fixture drifts onto another hour. */
    const recent = (days: number) => {
      const d = new Date(Date.now() - days * DAY_MS);
      d.setUTCHours(8, 0, 0, 0);
      return d;
    };

    await offers.insertMany([
      // ── The merchant's own history ──────────────────────────────────────
      // The bag that crosses midnight in Tunis carries the most sold units, so
      // it wins the day and hour buckets on volume rather than on a tie-break —
      // otherwise the assertion would pass for the wrong reason.
      offerDoc({
        merchantId,
        establishmentId: merchantEstablishmentId,
        status: OfferStatus.SOLD_OUT,
        originalPrice: 25,
        discountedPrice: 10,
        totalQuantity: 20,
        soldQuantity: 20,
        createdAt: crossesMidnightInTunis,
        publishedAt: crossesMidnightInTunis,
      }),
      // Three more sold-out bags at 10 TND, on three other days at 09:00 local.
      // Four sold-out offers in total is what unlocks the own-history basis.
      ...[6, 7, 8].map(days =>
        offerDoc({
          merchantId,
          establishmentId: merchantEstablishmentId,
          status: OfferStatus.SOLD_OUT,
          originalPrice: 25,
          discountedPrice: 10,
          totalQuantity: 5,
          soldQuantity: 5,
          createdAt: recent(days),
          publishedAt: recent(days),
        }),
      ),
      // An expired bag that sold nothing — concluded, so it counts against the
      // fill rate.
      offerDoc({
        merchantId,
        establishmentId: merchantEstablishmentId,
        status: OfferStatus.EXPIRED,
        originalPrice: 25,
        discountedPrice: 10,
        totalQuantity: 20,
        soldQuantity: 0,
        createdAt: recent(12),
      }),
      // Still running: priced in, but must not drag the fill rate down.
      offerDoc({
        merchantId,
        establishmentId: merchantEstablishmentId,
        status: OfferStatus.ACTIVE,
        originalPrice: 25,
        discountedPrice: 10,
        totalQuantity: 50,
        soldQuantity: 0,
        createdAt: recent(1),
      }),
      // Outside the 60-day window — must be invisible to every stage.
      offerDoc({
        merchantId,
        establishmentId: merchantEstablishmentId,
        status: OfferStatus.SOLD_OUT,
        originalPrice: 200,
        discountedPrice: 199,
        totalQuantity: 1,
        soldQuantity: 1,
        createdAt: recent(90),
      }),

      // ── Peer pastry shops in the same city: 4, 5 and 6 TND ──────────────
      ...[
        [peerA, 4],
        [peerB, 5],
        [peerC, 6],
      ].map(([est, price]) =>
        offerDoc({
          merchantId: new Types.ObjectId(),
          establishmentId: est as Types.ObjectId,
          status: OfferStatus.SOLD_OUT,
          originalPrice: 20,
          discountedPrice: price as number,
          totalQuantity: 10,
          soldQuantity: 10,
          createdAt: recent(3),
        }),
      ),

      // ── Noise that must be excluded from the peer average ───────────────
      offerDoc({
        merchantId: new Types.ObjectId(),
        establishmentId: restaurant,
        status: OfferStatus.SOLD_OUT,
        originalPrice: 120,
        discountedPrice: 40,
        totalQuantity: 10,
        soldQuantity: 10,
        createdAt: recent(3),
      }),
      offerDoc({
        merchantId: new Types.ObjectId(),
        establishmentId: otherCityPastry,
        status: OfferStatus.SOLD_OUT,
        originalPrice: 120,
        discountedPrice: 60,
        totalQuantity: 10,
        soldQuantity: 10,
        createdAt: recent(3),
      }),
    ]);

    service = Object.create(OffersService.prototype) as OffersService;
    Object.assign(service, {
      offerModel,
      establishmentsService: {
        findByOwnerId: jest.fn().mockResolvedValue({
          establishments: [{ address: { city: CITY }, type: EstablishmentType.PASTRY_SHOP }],
        }),
      },
    });
  });

  afterAll(async () => {
    await connection?.dropDatabase();
    await connection?.close();
  });

  it('accepts every stage — the pipelines actually run', async () => {
    await expect(service.getPricingSuggestions(merchantId.toString())).resolves.toBeDefined();
  });

  it('counts only offers inside the 60-day window', async () => {
    const { merchantStats } = await service.getPricingSuggestions(merchantId.toString());

    // 4 sold out + 1 expired + 1 active = 6. The 90-day-old one is excluded, and
    // it was priced at 199 TND precisely so its inclusion would be unmissable.
    expect(merchantStats.totalOffers).toBe(6);
    expect(merchantStats.avgDiscountedPrice).toBe(10);
  });

  it('measures fill rate over concluded offers only', async () => {
    const { merchantStats } = await service.getPricingSuggestions(merchantId.toString());

    // Concluded: (20 of 20) + 3 × (5 of 5) sold out + (0 of 20) expired
    //          = 35 of 55 = 64%.
    // The 50-unit active offer would drag this to 33% if it were counted.
    expect(merchantStats.fillRate).toBe(64);
  });

  it('averages only same-type peers in the same city, never the merchant themselves', async () => {
    const { zoneStats } = await service.getPricingSuggestions(merchantId.toString());

    expect(zoneStats.scope).toBe('category_city');
    expect(zoneStats.totalMerchants).toBe(3);
    // (4 + 5 + 6) / 3 = 5. The merchant's own 10 TND bags, the restaurant's
    // 40 TND and the other city's 60 TND are all outside the population.
    expect(zoneStats.avgDiscountedPrice).toBe(5);
  });

  it('buckets the best day in Africa/Tunis, not UTC', async () => {
    const { merchantStats } = await service.getPricingSuggestions(merchantId.toString());

    const tunisDay = weekdayIn(crossesMidnightInTunis, TIMEZONE);
    const utcDay = weekdayIn(crossesMidnightInTunis, 'UTC');

    // The fixture is built so these differ; if they ever stopped differing the
    // assertion below would prove nothing, so it is checked explicitly.
    expect(tunisDay).not.toBe(utcDay);
    expect(merchantStats.bestDayOfWeek).toBe(tunisDay);
  });

  it('buckets the best hour in Africa/Tunis, not UTC', async () => {
    const { merchantStats } = await service.getPricingSuggestions(merchantId.toString());

    expect(hourIn(crossesMidnightInTunis, 'UTC')).toBe(23);
    expect(merchantStats.bestHour).toBe(hourIn(crossesMidnightInTunis, TIMEZONE));
    expect(merchantStats.bestHour).toBe(0);
  });

  it('derives the suggested range from the merchant own sold-out prices', async () => {
    const { suggestedPriceRange } = await service.getPricingSuggestions(merchantId.toString());

    expect(suggestedPriceRange).toEqual({
      min: 9,
      max: 11,
      currency: 'TND',
      basis: 'own_history',
    });
  });

  it('advises on price against the peer average it just computed', async () => {
    const { insights } = await service.getPricingSuggestions(merchantId.toString());

    // 10 TND against a 5 TND peer average is +100%, past the +15% threshold.
    expect(insights).toContainEqual({
      type: 'price_above_zone',
      impact: 'high',
      params: { yourPrice: 10, zonePrice: 5, diffPercent: 100 },
    });
  });

  it('returns a zeroed payload for a merchant with no offers at all', async () => {
    const stranger = new Types.ObjectId();
    const result = await service.getPricingSuggestions(stranger.toString());

    expect(result.merchantStats.totalOffers).toBe(0);
    expect(result.merchantStats.bestDayOfWeek).toBeNull();
    expect(result.suggestedPriceRange).not.toBeNull();
    // No history of their own, so the peer average is the only basis available.
    expect(result.suggestedPriceRange?.basis).toBe('zone');
  });
});
