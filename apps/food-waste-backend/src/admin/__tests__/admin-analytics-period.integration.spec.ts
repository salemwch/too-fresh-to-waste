/**
 * The admin dashboard's period selector, against a real MongoDB.
 *
 * ## The bugs this pins down
 *
 * Every one of these shipped, and none of them failed a test or a type-check.
 *
 * 1. **Revenue was always zero.** The pipelines summed `$totalAmount`, a field
 *    that does not exist on the order schema - orders store `pricing.total`.
 *    `$sum` of a missing path is 0, silently, so every revenue card read 0 for
 *    every period since the dashboard was built.
 *
 * 2. **Revenue matched the wrong statuses.** The filter was `status:
 *    'completed'`. A pickup order ends at `PICKED_UP` and a delivery order at
 *    `DELIVERED`, so the entire delivery chain and most of the pickup chain
 *    were excluded.
 *
 * 3. **Commission used the wrong rate and the wrong base.** `total * 0.15`
 *    rather than `subtotal * PLATFORM_FOOD_SHARE`. Splitting `total` hands the
 *    merchant a share of the delivery fee, which is the exact mistake
 *    `order-pricing.util.ts` exists to prevent.
 *
 * 4. **The period selector did nothing to users or establishments.** Both
 *    methods counted lifetime totals; one took its parameter as `_period` and
 *    genuinely never read it. Choosing "Today" still reported every user ever
 *    registered.
 *
 * A mocked `aggregate()` cannot catch any of these - it would assert the
 * pipeline object was built, not what MongoDB returns for it. That is the whole
 * reason this suite runs against a real database.
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import {
  EstablishmentSchema,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { OfferSchema, type OfferDocument } from '../../offers/schemas/offer.schema';
import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import { ReviewSchema, type ReviewDocument } from '../../reviews/schemas/review.schema';
import { UserSchema, type UserDocument } from '../../users/schemas/user.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { AnalyticsPeriodType } from '../dto/admin-analytics.dto';
import { AdminAnalyticsService } from '../services/admin-analytics.service';

const MONGO_URI = requireMongoTestUri();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Food 20 + delivery 4. Commission is 19% of the FOOD line, never of 24. */
const SUBTOTAL = 20;
const DELIVERY_FEE = 4;
const TOTAL = SUBTOTAL + DELIVERY_FEE;

describe('AdminAnalyticsService — period filtering against a real MongoDB', () => {
  let connection: Connection;
  let service: AdminAnalyticsService;
  let orderModel: Model<OrderDocument>;
  let userModel: Model<UserDocument>;
  let establishmentModel: Model<EstablishmentDocument>;

  const now = new Date();
  /*
   * Today, and already past. This used to be 12:00 today, which is in the future
   * every morning: the service rightly excludes it, so this suite failed before
   * noon and passed after. Halfway between midnight and now is always both.
   */
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEarlier = new Date(
    startOfToday.getTime() + Math.floor((now.getTime() - startOfToday.getTime()) / 2),
  );
  const threeDaysAgo = new Date(now.getTime() - 3 * DAY);
  const twoYearsAgo = new Date(now.getTime() - 730 * DAY);

  const order = (createdAt: Date, status: OrderStatus) => ({
    _id: new Types.ObjectId(),
    orderNumber: `ORD-${Math.random().toString(36).slice(2, 10)}`,
    customerId: new Types.ObjectId(),
    merchantId: new Types.ObjectId(),
    establishmentId: new Types.ObjectId(),
    status,
    pricing: {
      subtotal: SUBTOTAL,
      discountAmount: 0,
      taxAmount: 0,
      deliveryFee: DELIVERY_FEE,
      total: TOTAL,
      currency: 'TND',
    },
    createdAt,
    updatedAt: createdAt,
  });

  const user = (createdAt: Date) => ({
    _id: new Types.ObjectId(),
    firstName: 'Test',
    lastName: 'User',
    email: `u${Math.random().toString(36).slice(2, 10)}@example.test`,
    role: 'consumer',
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  });

  /** Runs the real service with the cache bypassed so each period is computed. */
  const analyticsFor = async (period: AnalyticsPeriodType) => {
    const result = await service.getPlatformAnalytics({ period, includeDetails: false });
    return result;
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `admin_analytics_period_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;
    userModel = connection.model('User', UserSchema) as unknown as Model<UserDocument>;
    establishmentModel = connection.model(
      'Establishment',
      EstablishmentSchema,
    ) as unknown as Model<EstablishmentDocument>;
    const offerModel = connection.model('Offer', OfferSchema) as unknown as Model<OfferDocument>;
    const reviewModel = connection.model(
      'Review',
      ReviewSchema,
    ) as unknown as Model<ReviewDocument>;

    service = Object.create(AdminAnalyticsService.prototype) as AdminAnalyticsService;
    Object.assign(service, {
      userModel,
      establishmentModel,
      orderModel,
      offerModel,
      reviewModel,
      // Pass-through cache: the point is to compare periods, and a shared cache
      // would serve the first period's answer for all of them.
      redisCache: {
        getOrSet: async (_k: string, factory: () => Promise<unknown>) => {
          const fresh = await factory();
          return fresh;
        },
      },
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });

    // 2 orders today, 1 three days ago, 1 two years ago. One of today's is a
    // DELIVERED order - the status the old `'completed'` filter dropped.
    await orderModel.collection.insertMany([
      order(todayEarlier, OrderStatus.PICKED_UP),
      order(todayEarlier, OrderStatus.DELIVERED),
      order(threeDaysAgo, OrderStatus.PICKED_UP),
      order(twoYearsAgo, OrderStatus.PICKED_UP),
      // Never counts toward revenue, in any period.
      order(todayEarlier, OrderStatus.CANCELLED),
    ] as never[]);

    await userModel.collection.insertMany([
      user(todayEarlier),
      user(threeDaysAgo),
      user(twoYearsAgo),
    ] as never[]);

    await establishmentModel.collection.insertMany([
      {
        _id: new Types.ObjectId(),
        name: 'Today Shop',
        status: 'active',
        isActive: true,
        createdAt: todayEarlier,
      },
      {
        _id: new Types.ObjectId(),
        name: 'Old Shop',
        status: 'active',
        isActive: true,
        createdAt: twoYearsAgo,
      },
    ] as never[]);
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  describe('revenue reads the field orders actually store', () => {
    it('reports non-zero revenue for all time', async () => {
      const { revenue } = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      // Summing the old `$totalAmount` - a path no order has - returned 0 here
      // for every period since the dashboard existed.
      expect(revenue.totalRevenue).toBeGreaterThan(0);
    });

    it('sums pricing.total across every revenue-earning status', async () => {
      const { revenue } = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      // 4 earning orders (2 today, 1 recent, 1 old); the cancelled one is out.
      expect(revenue.totalRevenue).toBe(4 * TOTAL);
    });

    it('counts DELIVERED orders, which the old completed-only filter dropped', async () => {
      const { revenue } = await analyticsFor(AnalyticsPeriodType.DAY);

      // Today has one PICKED_UP and one DELIVERED. Matching `'completed'` alone
      // would have returned 0 here.
      expect(revenue.totalRevenue).toBe(2 * TOTAL);
    });

    it('takes commission on the food line at the platform rate, not on the gross', async () => {
      const { revenue } = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      // 19% of subtotal, not 15% of total. Splitting `total` would hand the
      // merchant a share of the delivery fee.
      expect(revenue.platformCommission).toBeCloseTo(4 * SUBTOTAL * PLATFORM_FOOD_SHARE, 2);
      expect(revenue.platformCommission).not.toBeCloseTo(4 * TOTAL * 0.15, 2);
    });
  });

  describe('the period selector actually scopes the numbers', () => {
    it('counts only today’s users for DAY', async () => {
      const { users } = await analyticsFor(AnalyticsPeriodType.DAY);

      // The complaint that started this: "Today" reported every user ever
      // registered, because the pipeline never read the period.
      expect(users.totalUsers).toBe(1);
    });

    it('counts every user for ALL_TIME', async () => {
      const { users } = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      expect(users.totalUsers).toBe(3);
    });

    it('widens monotonically from day to all time', async () => {
      const day = await analyticsFor(AnalyticsPeriodType.DAY);
      const week = await analyticsFor(AnalyticsPeriodType.WEEK);
      const all = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      // A longer window can never contain fewer records than a shorter one.
      // Asserted as a chain rather than three fixed numbers so the property
      // survives changes to the fixture.
      expect(day.users.totalUsers).toBeLessThanOrEqual(week.users.totalUsers);
      expect(week.users.totalUsers).toBeLessThanOrEqual(all.users.totalUsers);

      expect(day.orders.totalOrders).toBeLessThanOrEqual(week.orders.totalOrders);
      expect(week.orders.totalOrders).toBeLessThanOrEqual(all.orders.totalOrders);

      expect(day.revenue.totalRevenue).toBeLessThanOrEqual(week.revenue.totalRevenue);
      expect(week.revenue.totalRevenue).toBeLessThanOrEqual(all.revenue.totalRevenue);
    });

    it('scopes establishments too, which ignored the period entirely', async () => {
      const day = await analyticsFor(AnalyticsPeriodType.DAY);
      const all = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      expect(day.establishments.totalEstablishments).toBe(1);
      expect(all.establishments.totalEstablishments).toBe(2);
    });

    it('keeps the explicitly-named windows fixed regardless of the selection', async () => {
      const day = await analyticsFor(AnalyticsPeriodType.DAY);
      const all = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      // `newUsersToday` promises today in its name. Scoping it to the selected
      // period would make the label lie, so it stays fixed on purpose.
      expect(day.users.newUsersToday).toBe(all.users.newUsersToday);
      expect(day.users.newUsersThisWeek).toBe(all.users.newUsersThisWeek);
    });

    it('reports the window it actually used', async () => {
      const { period } = await analyticsFor(AnalyticsPeriodType.ALL_TIME);

      expect(period.periodType).toBe(AnalyticsPeriodType.ALL_TIME);
      // Epoch, so nothing is excluded by date.
      expect(period.startDate.getTime()).toBe(0);
    });
  });

  describe('empty results are zero, not a crash', () => {
    it('returns zeroes for a period with no data rather than throwing', async () => {
      // A brand-new platform, or a quiet day, hits every `?? 0` fallback at once.
      const empty = await service.getPlatformAnalytics({
        period: AnalyticsPeriodType.CUSTOM,
        startDate: new Date(twoYearsAgo.getTime() - 60 * DAY).toISOString(),
        endDate: new Date(twoYearsAgo.getTime() - 30 * DAY).toISOString(),
        includeDetails: false,
      });

      expect(empty.users.totalUsers).toBe(0);
      expect(empty.orders.totalOrders).toBe(0);
      expect(empty.revenue.totalRevenue).toBe(0);
      expect(empty.revenue.platformCommission).toBe(0);
    });
  });
});
