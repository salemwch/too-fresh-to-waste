/**
 * The settlement path, against a real MongoDB replica set.
 *
 * `commission-settlement.spec.ts` proves the arithmetic and
 * `commission.service.spec.ts` proves the branching against mocks. Neither can
 * prove the two things that actually decide whether this model loses money in
 * production, because both need a real database:
 *
 * 1. **Idempotency under concurrency.** PM2 runs one worker per core and the
 *    pickup path retries. Two workers applying the same order must produce one
 *    accrual, not two. That guarantee lives in the unique
 *    `(orderId, type)` index - a mocked model cannot enforce an index.
 * 2. **Read-modify-write safety.** The 50% cap means the new balance depends on
 *    the old one, so it cannot be a bare `$inc`. It is only safe because it
 *    runs inside `session.withTransaction()`, where MongoDB turns a concurrent
 *    write into a conflict the transaction retries. Mocks have no isolation and
 *    would report this safe either way.
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
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import {
  CommissionLedgerSchema,
  CommissionLedgerType,
  type CommissionLedgerDocument,
} from '../schemas/commission-ledger.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { CommissionService } from '../services/commission.service';

const MONGO_URI = requireMongoTestUri();

const BAG = 5;

describe('CommissionService — against a real MongoDB replica set', () => {
  let connection: Connection;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let service: CommissionService;

  const merchantId = new Types.ObjectId();

  /** A fresh establishment per test, so balances never leak between them. */
  const freshEstablishment = async (commissionDue = 0): Promise<Types.ObjectId> => {
    const id = new Types.ObjectId();
    await establishmentModel.collection.insertOne({
      _id: id,
      name: 'Test Pâtisserie',
      ownerId: merchantId,
      commissionDue,
    } as never);
    return id;
  };

  /** Runs one order through the real transactional path. */
  const applyOrder = async (establishmentId: Types.ObjectId, orderId: Types.ObjectId) => {
    const session = await connection.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        result = await service.applyForOrder(
          { establishmentId, merchantId, orderId, subtotal: BAG },
          session,
        );
      });
      return result;
    } finally {
      await session.endSession();
    }
  };

  const balanceOf = async (id: Types.ObjectId): Promise<number> => {
    const doc = await establishmentModel.findById(id).select('commissionDue').lean();
    return doc?.commissionDue ?? 0;
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `commission_settlement_${Date.now()}`,
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

    // The unique (orderId, type) index is the idempotency guarantee under test.
    // `autoIndex` is off in production, so build it explicitly rather than
    // assuming Mongoose did - otherwise this suite would pass by accident.
    await ledgerModel.syncIndexes();

    service = Object.create(CommissionService.prototype) as CommissionService;
    Object.assign(service, {
      establishmentModel,
      ledgerModel,
      logger: { error: jest.fn(), log: jest.fn(), debug: jest.fn() },
    });
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it('builds the unique (orderId, type) index this suite depends on', async () => {
    const indexes = await ledgerModel.collection.indexes();
    const guard = indexes.find(i => i.name === 'uniq_commission_ledger_order_type');

    expect(guard).toBeDefined();
    expect(guard?.unique).toBe(true);
  });

  describe('a single order', () => {
    it('credits the merchant the full price and accrues the commission', async () => {
      const est = await freshEstablishment();

      const result = await applyOrder(est, new Types.ObjectId());

      expect(result).toMatchObject({ accrued: 0.95, settled: 0, merchantAmount: BAG });
      expect(await balanceOf(est)).toBe(0.95);
    });

    it('writes the accrual row and its balance snapshot', async () => {
      const est = await freshEstablishment();
      const orderId = new Types.ObjectId();

      await applyOrder(est, orderId);
      const rows = await ledgerModel.find({ orderId }).lean();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: CommissionLedgerType.ACCRUAL,
        amount: 0.95,
        balanceAfter: 0.95,
      });
    });

    it('writes both rows on a settling order, never a single net row', async () => {
      const est = await freshEstablishment(4.75);
      const orderId = new Types.ObjectId();

      await applyOrder(est, orderId);
      const rows = await ledgerModel.find({ orderId }).sort({ createdAt: 1 }).lean();

      // Collapsing these into one net row is what erases the evidence that the
      // sale carried commission - the 19% vs 16% distinction.
      expect(rows.map(r => r.type)).toEqual([
        CommissionLedgerType.ACCRUAL,
        CommissionLedgerType.SETTLEMENT,
      ]);
      expect(await balanceOf(est)).toBe(3.2);
    });
  });

  describe('idempotency', () => {
    it('applies the same order twice as a no-op, not a second accrual', async () => {
      const est = await freshEstablishment();
      const orderId = new Types.ObjectId();

      const first = await applyOrder(est, orderId);
      const second = await applyOrder(est, orderId);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(await balanceOf(est)).toBe(0.95);
      expect(await ledgerModel.countDocuments({ orderId })).toBe(1);
    });

    it('lets the database reject a duplicate accrual even if the guard is bypassed', async () => {
      // Belt and braces: the service checks first, but the index is what holds
      // when two workers pass that check simultaneously. Asserted directly so a
      // future refactor of the guard cannot silently remove the real guarantee.
      const est = await freshEstablishment();
      const orderId = new Types.ObjectId();
      await applyOrder(est, orderId);

      await expect(
        ledgerModel.collection.insertOne({
          establishmentId: est,
          merchantId,
          orderId,
          type: CommissionLedgerType.ACCRUAL,
          amount: 0.95,
          balanceAfter: 1.9,
          currency: 'TND',
        } as never),
      ).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('concurrency', () => {
    it('loses no accrual when many distinct orders land at once', async () => {
      const est = await freshEstablishment();
      const orders = Array.from({ length: 12 }, () => new Types.ObjectId());

      /*
       * The real hazard: `applyForOrder` reads the balance, computes, writes.
       * Twelve of those overlapping outside a transaction would interleave and
       * lose accruals. Inside one, MongoDB raises a write conflict and retries,
       * so every order must be accounted for.
       */
      const results = await Promise.allSettled(
        orders.map(async id => {
          const applied = await applyOrder(est, id);
          return applied;
        }),
      );
      const rejected = results.filter(r => r.status === 'rejected');

      expect(rejected).toHaveLength(0);

      const accruals = await ledgerModel.countDocuments({
        establishmentId: est,
        type: CommissionLedgerType.ACCRUAL,
      });
      expect(accruals).toBe(orders.length);

      // Nothing discarded: balance == accrued - collected.
      const rows = await ledgerModel.find({ establishmentId: est }).lean();
      const accrued = rows
        .filter(r => r.type === CommissionLedgerType.ACCRUAL)
        .reduce((s, r) => s + r.amount, 0);
      const collected = rows
        .filter(r => r.type === CommissionLedgerType.SETTLEMENT)
        .reduce((s, r) => s + r.amount, 0);

      expect(await balanceOf(est)).toBeCloseTo(accrued - collected, 3);
    }, 60_000);

    it('applies the same order once when it arrives concurrently', async () => {
      const est = await freshEstablishment();
      const orderId = new Types.ObjectId();

      // Two PM2 workers, same retry, same instant.
      const results = await Promise.allSettled([
        applyOrder(est, orderId),
        applyOrder(est, orderId),
      ]);

      const applied = results.filter(r => r.status === 'fulfilled' && r.value !== null);

      expect(applied).toHaveLength(1);
      expect(await ledgerModel.countDocuments({ orderId })).toBe(1);
      expect(await balanceOf(est)).toBe(0.95);
    }, 60_000);
  });

  describe('the take rate, end to end', () => {
    it('converges on 19% across a long run of real orders', async () => {
      const est = await freshEstablishment();
      const ORDERS = 40;

      for (let i = 0; i < ORDERS; i += 1) {
        // Sequential on purpose: this measures the rate the model produces,
        // not its behaviour under contention (covered above).
        await applyOrder(est, new Types.ObjectId());
      }

      const rows = await ledgerModel.find({ establishmentId: est }).lean();
      const accrued = rows
        .filter(r => r.type === CommissionLedgerType.ACCRUAL)
        .reduce((s, r) => s + r.amount, 0);
      const collected = rows
        .filter(r => r.type === CommissionLedgerType.SETTLEMENT)
        .reduce((s, r) => s + r.amount, 0);
      const outstanding = await balanceOf(est);
      const gmv = ORDERS * BAG;

      // Conservation, through MongoDB rather than in JS.
      expect(collected + outstanding).toBeCloseTo(accrued, 3);
      // And the accrual is exactly 19% of everything sold.
      expect(accrued).toBeCloseTo(gmv * PLATFORM_FOOD_SHARE, 3);
      // Collection lags by at most one uncollected balance.
      expect(collected / gmv).toBeGreaterThan(PLATFORM_FOOD_SHARE - 0.03);
      expect(collected / gmv).toBeLessThanOrEqual(PLATFORM_FOOD_SHARE);
    }, 120_000);
  });

  describe('refund reversal', () => {
    it('restores the balance to what it was before a settled order', async () => {
      const est = await freshEstablishment(4.75);
      const orderId = new Types.ObjectId();

      await applyOrder(est, orderId);
      expect(await balanceOf(est)).toBe(3.2);

      const session = await connection.startSession();
      try {
        await session.withTransaction(async () => {
          await service.reverseForOrder(
            { establishmentId: est, merchantId, orderId, subtotal: BAG },
            1,
            session,
          );
        });
      } finally {
        await session.endSession();
      }

      // 3.200 + 2.500 settled back - 0.950 accrual removed = 4.750.
      expect(await balanceOf(est)).toBe(4.75);
      expect(
        await ledgerModel.countDocuments({ orderId, type: CommissionLedgerType.REVERSAL }),
      ).toBe(1);
    });

    it('is a no-op for an order that never reached pickup', async () => {
      const est = await freshEstablishment(3);

      const session = await connection.startSession();
      try {
        await session.withTransaction(async () => {
          await service.reverseForOrder(
            { establishmentId: est, merchantId, orderId: new Types.ObjectId(), subtotal: BAG },
            1,
            session,
          );
        });
      } finally {
        await session.endSession();
      }

      expect(await balanceOf(est)).toBe(3);
    });
  });
});
