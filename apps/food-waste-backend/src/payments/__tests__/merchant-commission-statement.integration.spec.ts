/**
 * The merchant's commission statement, against a real MongoDB.
 *
 * ## The bug this pins down
 *
 * The statement used to exist only per establishment. The web dashboard's
 * "All locations" filter has no establishment id, so it disabled the query -
 * and a disabled query reads as "still loading", so the card showed a skeleton
 * forever. A merchant looking at all their shops saw no commission at all.
 *
 * The single-location restriction was deliberate: summing the outstanding
 * balance across shops hides which one is carrying it. So the all-locations
 * statement sums the month (sold / commission / received are additive) and
 * reports the balance per establishment as well as in total.
 *
 * What is asserted, all against real queries:
 * - All locations sums every establishment the caller owns, and nothing else.
 * - `dueByEstablishment` names each balance, omits zeros, largest first, and
 *   adds up to `commissionDue`.
 * - The per-establishment path is unchanged, ownership check included.
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import mongoose, { Connection, Model, Types } from 'mongoose';

import {
  EstablishmentSchema,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import {
  CommissionLedgerSchema,
  CommissionLedgerType,
  type CommissionLedgerDocument,
} from '../schemas/commission-ledger.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { MerchantCommissionService } from '../services/merchant-commission.service';

const MONGO_URI = requireMongoTestUri();

describe('MerchantCommissionService — statement against a real MongoDB', () => {
  let connection: Connection;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let service: MerchantCommissionService;

  const addEstablishment = async (
    ownerId: Types.ObjectId,
    name: string,
    commissionDue: number,
  ): Promise<Types.ObjectId> => {
    const id = new Types.ObjectId();
    await establishmentModel.collection.insertOne({
      _id: id,
      name,
      ownerId,
      commissionDue,
    } as never);
    return id;
  };

  /** One sale: an accrual row, the shape `CommissionService` writes. */
  const addSale = async (
    establishmentId: Types.ObjectId,
    merchantId: Types.ObjectId,
    subtotal: number,
    createdAt = new Date(),
  ): Promise<void> => {
    const accrued = parseFloat((subtotal * 0.19).toFixed(3));
    await ledgerModel.collection.insertOne({
      establishmentId,
      merchantId,
      orderId: new Types.ObjectId(),
      type: CommissionLedgerType.ACCRUAL,
      amount: accrued,
      balanceDelta: accrued,
      balanceAfter: accrued,
      orderSubtotal: subtotal,
      merchantAmount: subtotal,
      currency: 'TND',
      createdAt,
      updatedAt: createdAt,
    } as never);
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `merchant_commission_statement_${Date.now()}`,
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

    service = new MerchantCommissionService(establishmentModel, ledgerModel);
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  describe('all locations', () => {
    it('sums the month across every establishment the merchant owns', async () => {
      const owner = new Types.ObjectId();
      const lac = await addEstablishment(owner, 'Lac', 0);
      const marsa = await addEstablishment(owner, 'Marsa', 0);
      await addSale(lac, owner, 10);
      await addSale(lac, owner, 5);
      await addSale(marsa, owner, 20);

      const statement = await service.getStatement(undefined, owner.toString());

      expect(statement.sales).toBe(35);
      expect(statement.commission).toBeCloseTo(35 * 0.19, 3);
      expect(statement.received).toBeCloseTo(35 - 35 * 0.19, 3);
      expect(statement.fullPriceOrders).toBe(3);
    });

    it("never includes another merchant's establishment", async () => {
      const owner = new Types.ObjectId();
      const other = new Types.ObjectId();
      const mine = await addEstablishment(owner, 'Mine', 1);
      const theirs = await addEstablishment(other, 'Theirs', 9);
      await addSale(mine, owner, 10);
      await addSale(theirs, other, 100);

      const statement = await service.getStatement(undefined, owner.toString());

      expect(statement.sales).toBe(10);
      expect(statement.commissionDue).toBe(1);
      expect(statement.dueByEstablishment.map(e => e.name)).toEqual(['Mine']);
    });

    it('names each balance, largest first, omitting zeros, and adds up to the total', async () => {
      const owner = new Types.ObjectId();
      const small = await addEstablishment(owner, 'Small', 0.95);
      const big = await addEstablishment(owner, 'Big', 3.8);
      await addEstablishment(owner, 'Settled', 0);

      const statement = await service.getStatement(undefined, owner.toString());

      expect(statement.dueByEstablishment).toEqual([
        { establishmentId: big.toString(), name: 'Big', amount: 3.8 },
        { establishmentId: small.toString(), name: 'Small', amount: 0.95 },
      ]);
      expect(statement.commissionDue).toBe(4.75);
    });

    it('leaves out sales from before this month', async () => {
      const owner = new Types.ObjectId();
      const est = await addEstablishment(owner, 'Old', 0);
      const now = new Date();
      await addSale(est, owner, 50, new Date(now.getFullYear(), now.getMonth() - 1, 15));
      await addSale(est, owner, 5);

      const statement = await service.getStatement(undefined, owner.toString());

      expect(statement.sales).toBe(5);
    });

    it('returns an empty month for a merchant with no establishment yet', async () => {
      const statement = await service.getStatement(undefined, new Types.ObjectId().toString());

      expect(statement).toMatchObject({
        sales: 0,
        commission: 0,
        received: 0,
        commissionDue: 0,
        dueByEstablishment: [],
      });
    });
  });

  describe('a single establishment', () => {
    it('reports only that establishment, even when the merchant owns others', async () => {
      const owner = new Types.ObjectId();
      const lac = await addEstablishment(owner, 'Lac', 1.9);
      const marsa = await addEstablishment(owner, 'Marsa', 5);
      await addSale(lac, owner, 10);
      await addSale(marsa, owner, 20);

      const statement = await service.getStatement(lac.toString(), owner.toString());

      expect(statement.sales).toBe(10);
      expect(statement.commissionDue).toBe(1.9);
      expect(statement.dueByEstablishment).toEqual([
        { establishmentId: lac.toString(), name: 'Lac', amount: 1.9 },
      ]);
    });

    it("refuses another merchant's establishment", async () => {
      const theirs = await addEstablishment(new Types.ObjectId(), 'Theirs', 2);

      await expect(
        service.getStatement(theirs.toString(), new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['not-an-id', new Types.ObjectId().toString()])('reports %p as not found', async id => {
      await expect(
        service.getStatement(id, new Types.ObjectId().toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
