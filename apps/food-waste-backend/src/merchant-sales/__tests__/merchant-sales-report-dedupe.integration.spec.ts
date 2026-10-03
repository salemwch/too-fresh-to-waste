/**
 * Task 17 (A4): the integrity report is deduped per (scope, period) across a
 * fixed window via the real Redis instance, so every PM2 worker agrees - a
 * burst of Dashboard + Payments + Analytics calls for the same merchant and
 * period must collapse into exactly one report, not one per request.
 *
 * Uses the real `RedisService`/`CacheService` (not a mock), the same pattern
 * as `auth/__tests__/login-attempt-limit.integration.spec.ts`.
 *
 *   docker compose up -d mongodb redis
 *   bash .superpowers/sdd/2026-09-26-merchant-earnings/testdb.sh merchant-sales-report-dedupe
 */

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { CacheService } from '../../common/services/cache.service';
import { RedisService } from '../../redis/redis.service';
import { OrderSchema, type OrderDocument } from '../../orders/schemas/order.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { MerchantSalesService } from '../merchant-sales.service';
import type { SalesScope } from '../merchant-sales.scope';

const T = (iso: string) => new Date(iso);
const CUTOFF = '2026-09-01T00:00:00+01:00';

describe('MerchantSalesService integrity report - deduped via real Redis (A4)', () => {
  let module: TestingModule;
  let cache: CacheService;
  let connection: Connection;
  let orders: Model<OrderDocument>;
  let service: MerchantSalesService;
  const sentry = { captureMessage: jest.fn() };
  const logger = { error: jest.fn() };

  const seed = async (merchantId: Types.ObjectId, moment: Date) => {
    const _id = new Types.ObjectId();
    await orders.collection.insertOne({
      _id,
      orderNumber: `ORD-${_id.toString().slice(-8)}`,
      merchantId,
      status: 'picked_up',
      deliveryMode: 'pickup',
      isDeleted: false,
      pricing: { subtotal: 5, discountAmount: 0, deliveryFee: 0, total: 5 },
      pickupDetails: { pickupCode: _id.toString().slice(-6), qrCode: `QR-${_id.toString()}` },
      pickedUpAt: moment, // post-cutoff, no commission decision -> UNVERIFIED
    } as never);
    return _id;
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CacheService,
        RedisService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            REDIS_HOST: process.env['REDIS_HOST'] ?? 'localhost',
            REDIS_PORT: process.env['REDIS_PORT'] ?? '6379',
            REDIS_PASSWORD: process.env['REDIS_PASSWORD'] ?? '',
          }),
        },
      ],
    }).compile();
    await module.init(); // RedisService connects in onModuleInit
    const redisService = module.get(RedisService);
    expect(redisService.isConnected()).toBe(true);
    cache = module.get(CacheService);

    connection = mongoose.createConnection(requireMongoTestUri(), {
      dbName: `merchant_sales_report_dedupe_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orders = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    service = Object.create(MerchantSalesService.prototype) as MerchantSalesService;
    Object.assign(service, {
      orderModel: orders,
      configService: {
        get: (k: string) => (k === 'COMMISSION_MODEL_EFFECTIVE_AT' ? CUTOFF : undefined),
      },
      sentry,
      logger,
      cache,
    });
  }, 60_000);

  afterAll(async () => {
    await orders.collection.deleteMany({});
    await connection.dropDatabase();
    await connection.close();
    await module.close();
  });

  beforeEach(async () => {
    sentry.captureMessage.mockClear();
    await orders.collection.deleteMany({});
  });

  it('two summary calls for the same scope and period within the window produce exactly one report', async () => {
    const merchantId = new Types.ObjectId();
    const scope: SalesScope = { kind: 'merchant', merchantId: merchantId.toString() };
    await seed(merchantId, T('2026-09-15T10:00:00Z'));

    const now = new Date('2026-09-26T12:00:00Z');
    const first = await service.summary(scope, 'month', now);
    const second = await service.summary(scope, 'month', now);

    expect(first.unverifiedOrders).toBe(1);
    expect(second.unverifiedOrders).toBe(1); // the figure itself is never suppressed, only the report
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('a different scope reports independently - the dedupe key is per scope, not global', async () => {
    const merchantA = new Types.ObjectId();
    const merchantB = new Types.ObjectId();
    await seed(merchantA, T('2026-09-15T10:00:00Z'));
    await seed(merchantB, T('2026-09-16T10:00:00Z'));

    const now = new Date('2026-09-26T12:00:00Z');
    await service.summary({ kind: 'merchant', merchantId: merchantA.toString() }, 'month', now);
    await service.summary({ kind: 'merchant', merchantId: merchantB.toString() }, 'month', now);

    expect(sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it('a different period reports independently - the dedupe key includes the period', async () => {
    const merchantId = new Types.ObjectId();
    await seed(merchantId, T('2026-09-15T10:00:00Z'));
    await seed(merchantId, T('2026-08-15T10:00:00Z'));

    const now = new Date('2026-09-26T12:00:00Z');
    const scope: SalesScope = { kind: 'merchant', merchantId: merchantId.toString() };
    await service.summary(scope, 'month', now); // the Sep order only
    await service.summary(scope, 'all', now); // both orders, different dedupe key

    expect(sentry.captureMessage).toHaveBeenCalledTimes(2);
  });
});
