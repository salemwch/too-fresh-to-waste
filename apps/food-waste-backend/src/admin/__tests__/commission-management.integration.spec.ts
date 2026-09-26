/**
 * The commission admin aggregations, against a real MongoDB.
 *
 * These are `$group` / `$lookup` / `$cond` pipelines. A mocked `.aggregate()`
 * would assert that a pipeline object was constructed, not that MongoDB
 * evaluates it the way the code assumes - which is the only thing worth
 * knowing here. Per `.claude/rules/testing.md`, mock-call assertions do not
 * count as coverage.
 *
 * ## What these pin down
 *
 * - **GMV is not double-counted.** A settling order writes an ACCRUAL *and* a
 *   SETTLEMENT row carrying the same `orderSubtotal`. Summing across every type
 *   inflates GMV and pushes the effective rate below 19% for exactly the
 *   merchants who settle most often.
 * - **The reconciliation identity.** `accrued - collected` must equal
 *   `sum(Establishment.commissionDue)`. This is the alarm the whole admin page
 *   exists for; if the aggregation computes it wrongly the alarm is worthless.
 * - **`$divide` by zero.** A merchant with rows but no GMV in the period aborts
 *   the entire aggregation unless guarded - not just that row.
 * - **The rate-drift filter excludes null rates** rather than treating "no
 *   data" as maximum drift.
 *
 * Requires the local stack:
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import {
  EstablishmentSchema,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import {
  CommissionLedgerSchema,
  CommissionLedgerType,
  type CommissionLedgerDocument,
} from '../../payments/schemas/commission-ledger.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import { UserSchema, type UserDocument } from '../../users/schemas/user.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { CommissionManagementService } from '../services/commission-management.service';

const MONGO_URI = requireMongoTestUri();

/** 5 TND bags: accrual 0.950, settlement capped at 2.500. */
const BAG = 5;
const ACCRUAL = 0.95;
const SETTLEMENT = 2.5;

describe('CommissionManagementService — against a real MongoDB', () => {
  let connection: Connection;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let userModel: Model<UserDocument>;
  let service: CommissionManagementService;

  const ownerId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();
  const quietEstablishmentId = new Types.ObjectId();

  /** Appends a ledger row the way CommissionService would. */
  const row = (
    estId: Types.ObjectId,
    type: CommissionLedgerType,
    amount: number,
    balanceAfter: number,
    orderSubtotal?: number,
  ) => ({
    establishmentId: estId,
    merchantId: ownerId,
    orderId: new Types.ObjectId(),
    type,
    amount,
    /*
     * Signed change to the balance, which is what reconciliation replays.
     * Accruals and positive adjustments add to it; settlements collect from it.
     */
    balanceDelta: type === CommissionLedgerType.SETTLEMENT ? -amount : amount,
    balanceAfter,
    ...(orderSubtotal === undefined ? {} : { orderSubtotal }),
    currency: 'TND',
  });

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `commission_admin_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    establishmentModel = connection.model(
      'Establishment',
      EstablishmentSchema,
    ) as unknown as Model<EstablishmentDocument>;
    ledgerModel = connection.model(
      'CommissionLedger',
      CommissionLedgerSchema,
    ) as unknown as Model<CommissionLedgerDocument>;
    userModel = connection.model('User', UserSchema) as unknown as Model<UserDocument>;

    // Real prototype methods with the two models they need - the service has no
    // other collaborators, so a full TestingModule would add nothing.
    service = Object.create(CommissionManagementService.prototype) as CommissionManagementService;
    Object.assign(service, {
      establishmentModel,
      ledgerModel,
      logger: { error: jest.fn(), log: jest.fn(), debug: jest.fn() },
    });

    await userModel.collection.insertOne({
      _id: ownerId,
      firstName: 'Salem',
      lastName: 'Pâtisserie',
      email: 'owner@example.test',
    } as never);

    /*
     * Six accruals and two settlements. Chosen so the two are distinguishable:
     * summing orderSubtotal over ALL types gives 8 x 5 = 40, over accruals only
     * gives 6 x 5 = 30. A double-counting bug therefore shows as 40, not as a
     * rounding wobble.
     */
    await establishmentModel.collection.insertOne({
      _id: establishmentId,
      name: 'Test Pâtisserie',
      ownerId,
      address: { city: 'Tunis' },
      commissionDue: 0.7,
    } as never);

    /*
     * Written through the model, not `collection.insertMany`. The raw driver
     * bypasses `timestamps: true`, and `createdAt` is load-bearing here - the
     * `lastSettlementAt` `$max` and the `neverSettled` filter both read it, so
     * a raw insert makes every merchant look never-settled and the test would
     * be asserting against a shape production never produces.
     */
    await ledgerModel.insertMany([
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 0.95, BAG),
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 1.9, BAG),
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 2.85, BAG),
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 3.8, BAG),
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 4.75, BAG),
      row(establishmentId, CommissionLedgerType.ACCRUAL, ACCRUAL, 5.7, BAG),
      row(establishmentId, CommissionLedgerType.SETTLEMENT, SETTLEMENT, 3.2, BAG),
      row(establishmentId, CommissionLedgerType.SETTLEMENT, SETTLEMENT, 0.7, BAG),
    ] as never[]);

    // A second establishment with a balance but no ledger rows in any period -
    // the shape that makes `$divide` explode if the guard is missing.
    await establishmentModel.collection.insertOne({
      _id: quietEstablishmentId,
      name: 'Quiet Bakery',
      ownerId,
      address: { city: 'Sousse' },
      commissionDue: 12,
    } as never);
    await ledgerModel.insertMany([
      row(quietEstablishmentId, CommissionLedgerType.ADJUSTMENT, 12, 12),
    ] as never[]);
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  describe('listMerchants', () => {
    it('sums GMV from accruals only, so settling orders are not counted twice', async () => {
      const { data } = await service.listMerchants({ limit: 50 });
      const shop = data.find(r => r.establishmentId === establishmentId.toString());

      // 6 accruals x 5 TND. Counting the 2 settlement rows too would give 40.
      expect(shop?.gmv).toBe(30);
      expect(shop?.accrued).toBe(5.7);
      expect(shop?.collected).toBe(5);
    });

    it('computes the effective rate from collected over GMV', async () => {
      const { data } = await service.listMerchants({ limit: 50 });
      const shop = data.find(r => r.establishmentId === establishmentId.toString());

      // 5 / 30 = 16.7% - below target because 0.700 is still outstanding, which
      // is exactly the lag an admin needs to be able to see.
      expect(shop?.effectiveRate).toBeCloseTo(5 / 30, 6);
    });

    it('joins the establishment and owner rather than returning raw ids', async () => {
      const { data } = await service.listMerchants({ limit: 50 });
      const shop = data.find(r => r.establishmentId === establishmentId.toString());

      expect(shop?.establishmentName).toBe('Test Pâtisserie');
      expect(shop?.merchantName).toBe('Salem Pâtisserie');
      expect(shop?.city).toBe('Tunis');
    });

    it('returns a null rate instead of aborting when a merchant has no GMV', async () => {
      // The whole aggregation fails on $divide by zero without the $cond guard,
      // so this asserts the OTHER rows survive too.
      const { data } = await service.listMerchants({ limit: 50 });
      const quiet = data.find(r => r.establishmentId === quietEstablishmentId.toString());

      expect(quiet).toBeDefined();
      expect(quiet?.gmv).toBe(0);
      expect(quiet?.effectiveRate).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by city', async () => {
      const { data } = await service.listMerchants({ city: 'Sousse', limit: 50 });

      expect(data).toHaveLength(1);
      expect(data[0]?.establishmentName).toBe('Quiet Bakery');
    });

    it('filters by outstanding balance', async () => {
      const { data } = await service.listMerchants({ minDue: 5, limit: 50 });

      expect(data.map(r => r.establishmentName)).toEqual(['Quiet Bakery']);
    });

    it('finds the never-settled merchant', async () => {
      const { data } = await service.listMerchants({ neverSettled: true, limit: 50 });

      expect(data.map(r => r.establishmentName)).toEqual(['Quiet Bakery']);
    });

    it('excludes null rates from the drift filter rather than treating them as drift', async () => {
      // Quiet Bakery has no rate at all. "No data" is not "broken", and
      // including it would bury real drifts under inactive merchants.
      const { data } = await service.listMerchants({ rateDriftAbove: 0.02, limit: 50 });

      expect(data.map(r => r.establishmentName)).not.toContain('Quiet Bakery');
      // Test Pâtisserie is at 16.7%, which is 2.3 points off 19% - over the bar.
      expect(data.map(r => r.establishmentName)).toContain('Test Pâtisserie');
    });

    it('escapes regex metacharacters in the search term', async () => {
      // An unescaped `(` is a 500 at best and a ReDoS at worst.
      await expect(service.listMerchants({ search: 'Pâtisserie (', limit: 50 })).resolves.toEqual(
        expect.objectContaining({ data: [] }),
      );
    });

    it('matches on establishment name', async () => {
      const { data } = await service.listMerchants({ search: 'Quiet', limit: 50 });

      expect(data.map(r => r.establishmentName)).toEqual(['Quiet Bakery']);
    });

    it('paginates with a stable total', async () => {
      const first = await service.listMerchants({ page: 1, limit: 1 });
      const second = await service.listMerchants({ page: 2, limit: 1 });

      expect(first.total).toBe(second.total);
      expect(first.data[0]?.establishmentId).not.toBe(second.data[0]?.establishmentId);
    });
  });

  describe('getSummary', () => {
    it('computes the reconciliation identity from both sources', async () => {
      const summary = await service.getSummary();

      // Ledger: 5.700 accrued (+12 adjustment is not an accrual), 5.000 collected.
      expect(summary.totalAccrued).toBe(5.7);
      expect(summary.totalCollected).toBe(5);
      // Balances: 0.700 + 12 = 12.700.
      expect(summary.totalDue).toBe(12.7);
      expect(summary.merchantsWithBalance).toBe(2);
    });

    it('reconciles a ledger that includes an adjustment, not only accruals', async () => {
      /*
       * Quiet Bakery's 12 TND arrived as an ADJUSTMENT. Reconciling from
       * `accrued - collected` classified that as a 12 TND drift and raised the
       * alarm on a ledger that was entirely correct - the same defect that made
       * every refund look like a discrepancy.
       */
      const summary = await service.getSummary();

      expect(summary.reconciliationDelta).toBe(0);
      expect(summary.reconciled).toBe(true);
    });

    it('raises the alarm when a balance moves without a ledger row', async () => {
      /*
       * The failure this alarm actually exists for: a write that changed the
       * running balance but left no trace in the ledger. Nothing else in the
       * product would notice, and the money is simply gone.
       */
      await establishmentModel.collection.updateOne(
        { _id: establishmentId },
        { $inc: { commissionDue: 7.5 } },
      );

      const summary = await service.getSummary();

      expect(summary.reconciled).toBe(false);
      expect(summary.reconciliationDelta).toBe(-7.5);

      await establishmentModel.collection.updateOne(
        { _id: establishmentId },
        { $inc: { commissionDue: -7.5 } },
      );
    });

    it('still reconciles after a refund', async () => {
      /*
       * The identity used to be `accrued - collected - totalDue`, which omits
       * REVERSAL rows - so a single refund broke it by that refund's value and
       * the alarm fired on a perfectly healthy ledger. An alarm that cries wolf
       * after every refund is worse than no alarm.
       *
       * Reconciliation now replays `balanceDelta`, which every row carries.
       */
      const refunded = new Types.ObjectId();
      await ledgerModel.insertMany([
        {
          establishmentId,
          merchantId: ownerId,
          orderId: refunded,
          type: CommissionLedgerType.REVERSAL,
          amount: 0.95,
          balanceDelta: -0.95,
          balanceAfter: -0.25,
          currency: 'TND',
        },
      ] as never[]);
      await establishmentModel.collection.updateOne(
        { _id: establishmentId },
        { $inc: { commissionDue: -0.95 } },
      );

      const summary = await service.getSummary();

      expect(summary.reconciled).toBe(true);
      expect(summary.reconciliationDelta).toBe(0);

      // Clean up so the later assertions start from a known state.
      await ledgerModel.deleteOne({ orderId: refunded });
      await establishmentModel.collection.updateOne(
        { _id: establishmentId },
        { $inc: { commissionDue: 0.95 } },
      );
    });

    it('counts a negative balance as real, not as nothing', async () => {
      // A credit is as real as a debt. Matching only `> 0` would drop them and
      // make the identity fail by exactly the credits outstanding.
      await establishmentModel.collection.updateOne(
        { _id: quietEstablishmentId },
        { $set: { commissionDue: -3 } },
      );

      const summary = await service.getSummary();

      expect(summary.merchantsWithBalance).toBe(2);
      expect(summary.totalDue).toBeCloseTo(0.7 - 3, 3);

      await establishmentModel.collection.updateOne(
        { _id: quietEstablishmentId },
        { $set: { commissionDue: 12 } },
      );
    });

    it('reconciles exactly when every movement is an accrual or settlement', async () => {
      // Same arithmetic the settlement path produces: balance = accrued - collected.
      await establishmentModel.collection.updateOne(
        { _id: quietEstablishmentId },
        { $set: { commissionDue: 0 } },
      );
      await ledgerModel.collection.deleteMany({ establishmentId: quietEstablishmentId });

      const summary = await service.getSummary();

      expect(summary.totalAccrued - summary.totalCollected).toBeCloseTo(summary.totalDue, 3);
      expect(summary.reconciliationDelta).toBe(0);
      expect(summary.reconciled).toBe(true);
      expect(summary.effectiveRate).toBeCloseTo(5 / 30, 6);
    });
  });

  describe('getLedger', () => {
    it('returns the movements newest first with the establishment name', async () => {
      const result = await service.getLedger(establishmentId.toString(), 1, 50);

      expect(result.establishmentName).toBe('Test Pâtisserie');
      expect(result.total).toBe(8);
      expect(result.data).toHaveLength(8);
      expect(result.data.every(r => typeof r.createdAt === 'string')).toBe(true);
    });

    it('rejects a malformed id instead of querying with it', async () => {
      await expect(service.getLedger('not-an-object-id')).rejects.toMatchObject({
        response: { code: 'INVALID_ID' },
      });
    });

    it('404s for an id that does not exist', async () => {
      await expect(service.getLedger(new Types.ObjectId().toString())).rejects.toMatchObject({
        status: 404,
        response: { code: 'ESTABLISHMENT_NOT_FOUND' },
      });
    });
  });

  describe('the take rate this whole model targets', () => {
    it('reaches 19% once the outstanding balance is collected', async () => {
      // The realised rate lags while a balance is carried; the invariant is that
      // collected + outstanding equals 19% of GMV. Proven here end to end
      // through MongoDB rather than in JS.
      const summary = await service.getSummary();
      const { data } = await service.listMerchants({ limit: 50 });
      const shop = data.find(r => r.establishmentId === establishmentId.toString());

      expect(summary.totalCollected + summary.totalDue).toBeCloseTo(
        (shop?.gmv ?? 0) * PLATFORM_FOOD_SHARE,
        3,
      );
    });
  });
});
