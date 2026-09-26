/**
 * Driver cash, end to end against a real MongoDB replica set.
 *
 * The pure arithmetic is `driver-cash.util.spec.ts`. This proves what only a
 * database can: that each lifecycle step commits the status, the commission
 * decision, the cash record and the frozen instruction TOGETHER, that a
 * retried or concurrent request is a no-op rather than a second merchant
 * payment, and that handovers and reconciliation add up across real rows.
 *
 * Every worked row of "Driver cash" in
 * `.claude/work/commission-settlement-model.md` runs here through the real
 * transaction path, with fee 4 split 80 / 20 (driver 3.20, TFTW 0.80).
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import {
  EstablishmentSchema,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import {
  CommissionLedgerSchema,
  CommissionLedgerType,
  type CommissionLedgerDocument,
} from '../../payments/schemas/commission-ledger.schema';
import { MerchantPayoutLedgerSchema } from '../../payments/schemas/merchant-payout-ledger.schema';
import {
  PaymentSchema,
  PaymentStatus,
  type PaymentDocument,
} from '../../payments/schemas/payment.schema';
import { PlatformTransactionSchema } from '../../payments/schemas/platform-transaction.schema';
import { CommissionService } from '../../payments/services/commission.service';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import {
  DriverCashHandoverSchema,
  type DriverCashHandoverDocument,
} from '../schemas/driver-cash-handover.schema';
import {
  DriverDeliveryCashSchema,
  type DriverDeliveryCashDocument,
} from '../schemas/driver-delivery-cash.schema';
import {
  DriverFloatMovementSchema,
  type DriverFloatMovementDocument,
} from '../schemas/driver-float-movement.schema';
import { DriverCashService } from '../services/driver-cash.service';

const MONGO_URI = requireMongoTestUri();

describe('DriverCashService — against a real MongoDB replica set', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let cashModel: Model<DriverDeliveryCashDocument>;
  let handoverModel: Model<DriverCashHandoverDocument>;
  let floatModel: Model<DriverFloatMovementDocument>;
  let paymentModel: Model<PaymentDocument>;
  let service: DriverCashService;

  /** In the past: every merchant pickup below is under the new model. */
  const CUTOFF = '2026-01-01T00:00:00+01:00';
  const admin = new Types.ObjectId();

  const establishment = async (commissionDue: number): Promise<Types.ObjectId> => {
    const id = new Types.ObjectId();
    await establishmentModel.collection.insertOne({
      _id: id,
      name: 'Pâtisserie Test',
      ownerId: new Types.ObjectId(),
      commissionDue,
    } as never);
    return id;
  };

  /** A delivery order already accepted by `driverId`, fee 4 split 3.20 / 0.80. */
  const assignedOrder = async (opts: {
    driverId: Types.ObjectId;
    establishmentId: Types.ObjectId;
    method: 'pay_on_delivery' | 'online';
    subtotal: number;
  }): Promise<Types.ObjectId> => {
    const id = new Types.ObjectId();
    const online = opts.method === 'online';
    await orderModel.collection.insertOne({
      _id: id,
      orderNumber: `ORD-${id.toString().slice(-8)}`,
      customerId: new Types.ObjectId(),
      merchantId: new Types.ObjectId(),
      establishmentId: opts.establishmentId,
      driverId: opts.driverId,
      status: OrderStatus.DRIVER_ASSIGNED,
      deliveryMode: 'delivery',
      paymentDetails: { method: opts.method, amount: opts.subtotal + 4, currency: 'TND' },
      paymentControl: online
        ? { controlledBy: 'TFTW', collector: 'PAYMENT_GATEWAY' }
        : { controlledBy: 'TFTW', collector: 'DRIVER' },
      ...(online ? { paymentProvider: 'konnect' } : {}),
      pricing: {
        subtotal: opts.subtotal,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 4,
        total: opts.subtotal + 4,
        currency: 'TND',
      },
      deliveryFee: 4,
      driverEarnings: 3.2,
      platformDeliveryCommission: 0.8,
      items: [],
      // The order schema holds unique indexes on both codes.
      pickupDetails: { pickupCode: id.toString().slice(-6), qrCode: `QR-${id.toString()}` },
    } as never);
    if (online) {
      await paymentModel.collection.insertOne({
        orderId: id,
        status: PaymentStatus.HELD,
        amount: opts.subtotal + 4,
        merchantTransactionId: `MTX-${id.toString()}`, // unique on the schema
      } as never);
    }
    return id;
  };

  const balanceOf = async (id: Types.ObjectId) =>
    (await establishmentModel.findById(id).select('commissionDue').lean())?.commissionDue ?? 0;

  const cashFor = (orderId: Types.ObjectId) => cashModel.findOne({ orderId }).lean();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `driver_cash_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;
    establishmentModel = connection.model(
      'Establishment',
      EstablishmentSchema,
    ) as unknown as Model<EstablishmentDocument>;
    ledgerModel = connection.model(
      'CommissionLedger',
      CommissionLedgerSchema,
    ) as unknown as Model<CommissionLedgerDocument>;
    cashModel = connection.model(
      'DriverDeliveryCash',
      DriverDeliveryCashSchema,
    ) as unknown as Model<DriverDeliveryCashDocument>;
    handoverModel = connection.model(
      'DriverCashHandover',
      DriverCashHandoverSchema,
    ) as unknown as Model<DriverCashHandoverDocument>;
    floatModel = connection.model(
      'DriverFloatMovement',
      DriverFloatMovementSchema,
    ) as unknown as Model<DriverFloatMovementDocument>;
    paymentModel = connection.model('Payment', PaymentSchema) as unknown as Model<PaymentDocument>;

    // The unique indexes ARE the idempotency guarantees; autoIndex is off in
    // production, so build them explicitly rather than pass by accident.
    await Promise.all([
      ledgerModel.syncIndexes(),
      cashModel.syncIndexes(),
      handoverModel.syncIndexes(),
    ]);

    const platformTxModel = connection.model('PlatformTransaction', PlatformTransactionSchema);
    await platformTxModel.syncIndexes();
    const commission = Object.create(CommissionService.prototype) as CommissionService;
    Object.assign(commission, {
      establishmentModel,
      ledgerModel,
      orderModel,
      platformTxModel,
      configService: {
        get: (key: string) => (key === 'COMMISSION_MODEL_EFFECTIVE_AT' ? CUTOFF : undefined),
      },
      logger: { error: jest.fn(), log: jest.fn(), debug: jest.fn(), warn: jest.fn() },
    });

    service = new DriverCashService(
      connection,
      orderModel,
      cashModel,
      handoverModel,
      floatModel,
      paymentModel,
      commission,
    );
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  describe('the worked flows, to the millime', () => {
    it.each([
      ['COD NORMAL 10', 'pay_on_delivery', 10, 0, 'NORMAL', 10, 14, 0.8, 1.9],
      ['COD SETTLEMENT, due 5, 10', 'pay_on_delivery', 10, 5, 'SETTLEMENT', 5, 14, 5.8, 0],
      ['COD full settlement, due 57, 57', 'pay_on_delivery', 57, 57, 'SETTLEMENT', 0, 61, 57.8, 0],
      ['online NORMAL 10', 'online', 10, 0, 'NORMAL', 10, 0, -13.2, 1.9],
      ['online SETTLEMENT, due 5, 10', 'online', 10, 5, 'SETTLEMENT', 5, 0, -8.2, 0],
    ] as const)(
      '%s',
      async (_l, method, subtotal, due, kind, payMerchant, collect, dueToTftw, dueAfter) => {
        const driverId = new Types.ObjectId();
        const est = await establishment(due);
        const orderId = await assignedOrder({ driverId, establishmentId: est, method, subtotal });

        const { instruction } = await service.onMerchantPickup(
          orderId.toString(),
          driverId.toString(),
        );

        // 1. The frozen instruction the driver follows.
        expect(instruction).toMatchObject({
          payMerchant,
          collectFromCustomer: collect,
          driverKeeps: 3.2,
        });
        const frozen = await orderModel.findById(orderId).lean();
        expect(frozen?.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
        expect(frozen?.driverInstruction).toMatchObject({
          payMerchant,
          collectFromCustomer: collect,
        });
        expect(frozen?.commission).toMatchObject({ model: 'V2', kind });
        expect(await balanceOf(est)).toBe(dueAfter);

        // 2. Delivery with the driver's confirmed amount.
        await service.onDelivered(orderId.toString(), driverId.toString(), collect);

        const cash = await cashFor(orderId);
        expect(cash).toMatchObject({
          kind,
          paidToMerchant: payMerchant,
          expectedCash: collect,
          collectedCash: collect,
          collectionConfirmedByDriver: true,
          driverKeeps: 3.2,
          tftwDeliveryRevenue: 0.8,
          dueToTftw,
          outstandingCash: dueToTftw,
          status: 'COLLECTED',
        });
      },
    );

    it.each(['pay_on_delivery', 'online'] as const)(
      'never creates a merchant payout for a %s delivery - the driver paid them at pickup',
      async method => {
        const payouts = connection.model('MerchantPayoutLedger', MerchantPayoutLedgerSchema);
        const driverId = new Types.ObjectId();
        const est = await establishment(0);
        const orderId = await assignedOrder({
          driverId,
          establishmentId: est,
          method,
          subtotal: 10,
        });

        await service.onMerchantPickup(orderId.toString(), driverId.toString());
        await service.onDelivered(
          orderId.toString(),
          driverId.toString(),
          method === 'online' ? 0 : 14,
        );

        // A payout here would pay the merchant twice: once in cash from the
        // float, again by transfer.
        expect(await payouts.countDocuments({ orderId })).toBe(0);
      },
    );

    it('marks the online payment EARNED at delivery', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'online',
        subtotal: 10,
      });

      await service.onMerchantPickup(orderId.toString(), driverId.toString());
      await service.onDelivered(orderId.toString(), driverId.toString(), 0);

      const payment = await paymentModel.findOne({ orderId }).lean();
      expect(payment?.status).toBe(PaymentStatus.EARNED);
    });
  });

  describe('once and only once', () => {
    it('two concurrent pickups pay the merchant once and decide commission once', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(5);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });

      const results = await Promise.allSettled([
        service.onMerchantPickup(orderId.toString(), driverId.toString()),
        service.onMerchantPickup(orderId.toString(), driverId.toString()),
      ]);

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      expect(await cashModel.countDocuments({ orderId })).toBe(1);
      expect(await ledgerModel.countDocuments({ orderId })).toBe(1);
      expect(await balanceOf(est)).toBe(0);
    }, 60_000);

    it('a second pickup of the same order is rejected, not re-decided', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(5);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());

      await expect(
        service.onMerchantPickup(orderId.toString(), driverId.toString()),
      ).rejects.toMatchObject({ response: { code: 'DRIVER_ORDER_NOT_YOURS' } });
      expect((await orderModel.findById(orderId).lean())?.driverInstruction?.payMerchant).toBe(5);
    });

    it('another driver cannot pick up an order that is not theirs', async () => {
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId: new Types.ObjectId(),
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });

      await expect(
        service.onMerchantPickup(orderId.toString(), new Types.ObjectId().toString()),
      ).rejects.toMatchObject({ response: { code: 'DRIVER_ORDER_NOT_YOURS' } });
      expect(await cashModel.countDocuments({ orderId })).toBe(0);
      expect(await balanceOf(est)).toBe(0);
    });
  });

  describe('collection', () => {
    it('flags an unconfirmed collection from an old app version', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());

      await service.onDelivered(orderId.toString(), driverId.toString());

      expect(await cashFor(orderId)).toMatchObject({
        collectedCash: 14,
        collectionConfirmedByDriver: false,
      });
      const report = await service.reconciliation({ driverId: driverId.toString() });
      expect(report.drivers[0]?.flags).toContain('UNCONFIRMED_COLLECTION');
    });

    it('records a short collection as SHORT and leaves the order delivered', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());

      await service.onDelivered(orderId.toString(), driverId.toString(), 12);

      expect(await cashFor(orderId)).toMatchObject({ status: 'SHORT', shortfall: 2 });
      expect((await orderModel.findById(orderId).lean())?.status).toBe(OrderStatus.DELIVERED);
    });

    it('refuses cash claimed on an online order, and rolls the whole step back', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'online',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());

      await expect(
        service.onDelivered(orderId.toString(), driverId.toString(), 14),
      ).rejects.toThrow();

      // The status claim was in the same transaction: still out for delivery.
      expect((await orderModel.findById(orderId).lean())?.status).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
      expect(await cashFor(orderId)).toMatchObject({ status: 'EXPECTED', collectedCash: null });
    });
  });

  describe('failed delivery', () => {
    const failedOrder = async (method: 'pay_on_delivery' | 'online', due = 0) => {
      const driverId = new Types.ObjectId();
      const est = await establishment(due);
      const orderId = await assignedOrder({ driverId, establishmentId: est, method, subtotal: 10 });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());
      return { driverId, est, orderId };
    };

    it('customer fault, food lost: sale and commission stand, TFTW books the loss', async () => {
      const { driverId, est, orderId } = await failedOrder('pay_on_delivery');

      await service.onFailed(orderId.toString(), driverId.toString(), {
        reason: 'CUSTOMER_REFUSED',
        recovery: 'UNRECOVERABLE',
      });

      const order = await orderModel.findById(orderId).lean();
      expect(order?.status).toBe(OrderStatus.CANCELLED);
      expect(order?.deliveryFailure).toMatchObject({
        reason: 'CUSTOMER_REFUSED',
        faultParty: 'CUSTOMER',
        recovery: 'UNRECOVERABLE',
      });
      expect(await balanceOf(est)).toBe(1.9); // the merchant's sale stands
      expect(await cashFor(orderId)).toMatchObject({
        status: 'FAILED',
        driverKeeps: 0,
        dueToTftw: -10,
        lossAmount: 10,
      });
    });

    it('food returned to the merchant: cash back, sale and its commission undone', async () => {
      const { driverId, est, orderId } = await failedOrder('pay_on_delivery');

      await service.onFailed(orderId.toString(), driverId.toString(), {
        reason: 'CUSTOMER_UNREACHABLE',
        recovery: 'RETURNED_TO_MERCHANT',
      });

      expect(await balanceOf(est)).toBe(0);
      expect(
        await ledgerModel.countDocuments({ orderId, type: CommissionLedgerType.REVERSAL }),
      ).toBe(1);
      expect(await cashFor(orderId)).toMatchObject({
        merchantReturnedCash: 10,
        dueToTftw: 0,
        lossAmount: 0,
      });
    });

    it('merchant fault cannot end with the merchant keeping the money', async () => {
      const { driverId, orderId } = await failedOrder('pay_on_delivery');

      await expect(
        service.onFailed(orderId.toString(), driverId.toString(), {
          reason: 'MERCHANT_FAULT',
          recovery: 'UNRECOVERABLE',
        }),
      ).rejects.toThrow(/merchant/i);
      expect((await orderModel.findById(orderId).lean())?.status).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
    });

    it('online order: no cash loss booked - TFTW already holds the payment', async () => {
      const { driverId, orderId } = await failedOrder('online');

      await service.onFailed(orderId.toString(), driverId.toString(), {
        reason: 'CUSTOMER_UNAVAILABLE',
        recovery: 'UNRECOVERABLE',
      });

      expect(await cashFor(orderId)).toMatchObject({ lossAmount: 0, dueToTftw: -10 });
    });

    it('lists a failure awaiting a recovery decision, and stops once it is resolved', async () => {
      const { driverId, orderId } = await failedOrder('pay_on_delivery');
      await service.onFailed(orderId.toString(), driverId.toString(), {
        reason: 'CUSTOMER_UNREACHABLE',
        recovery: 'RECOVERABLE_PENDING',
      });

      const before = await service.reconciliation({ driverId: driverId.toString() });
      expect(before.drivers[0]?.pendingRecoveries).toEqual([
        expect.objectContaining({ orderId: orderId.toString(), paidToMerchant: 10 }),
      ]);

      await service.resolveFailedRecovery(orderId.toString(), 'UNRECOVERABLE');

      const after = await service.reconciliation({ driverId: driverId.toString() });
      expect(after.drivers[0]?.pendingRecoveries).toEqual([]);
      expect(await cashFor(orderId)).toMatchObject({ recovery: 'UNRECOVERABLE' });
    });

    it('a pending recovery is resolved later by an admin, once', async () => {
      const { driverId, est, orderId } = await failedOrder('pay_on_delivery');
      await service.onFailed(orderId.toString(), driverId.toString(), {
        reason: 'CUSTOMER_REFUSED',
        recovery: 'RECOVERABLE_PENDING',
      });
      expect(await cashFor(orderId)).toMatchObject({ lossAmount: 0 });

      await service.resolveFailedRecovery(orderId.toString(), 'RETURNED_TO_MERCHANT');

      expect(await cashFor(orderId)).toMatchObject({ merchantReturnedCash: 10, dueToTftw: 0 });
      expect(await balanceOf(est)).toBe(0);
      await expect(
        service.resolveFailedRecovery(orderId.toString(), 'UNRECOVERABLE'),
      ).rejects.toThrow();
    });
  });

  describe('float, handovers and reconciliation', () => {
    it('reconciles a day: expected vs collected vs handed over vs outstanding', async () => {
      const driverId = new Types.ObjectId();
      const d = driverId.toString();
      await service.moveFloat({
        driverId: d,
        type: 'ISSUED',
        amount: 50,
        actorId: admin.toString(),
      });

      // COD NORMAL (+0.80), COD SETTLEMENT (+5.80), online NORMAL (-13.20).
      const flows = [
        { method: 'pay_on_delivery' as const, due: 0, collect: 14 },
        { method: 'pay_on_delivery' as const, due: 5, collect: 14 },
        { method: 'online' as const, due: 0, collect: 0 },
      ];
      for (const flow of flows) {
        const est = await establishment(flow.due);
        const orderId = await assignedOrder({
          driverId,
          establishmentId: est,
          method: flow.method,
          subtotal: 10,
        });
        await service.onMerchantPickup(orderId.toString(), d);
        await service.onDelivered(orderId.toString(), d, flow.collect);
      }

      const before = await service.reconciliation({ driverId: d });
      expect(before.drivers[0]).toMatchObject({
        expectedCash: 28,
        collectedCash: 28,
        handedOverCash: 0,
        outstandingOwedByDriver: 6.6,
        outstandingOwedToDriver: 13.2,
        driverDeliveryEarnings: 9.6,
        tftwDeliveryRevenue: 2.4,
        tftwCommissionSettlement: 5,
        float: 50,
        // 50 float + 6.60 owed - 13.20 owed back = what should be in the pocket.
        cashDriverShouldHold: 43.4,
      });

      // Driver hands in the 6.60 they owe; TFTW replenishes the 13.20.
      await service.recordHandover({ driverId: d, amount: 6.6, receivedBy: admin.toString() });
      await service.recordHandover({ driverId: d, amount: -13.2, receivedBy: admin.toString() });

      const after = await service.reconciliation({ driverId: d });
      expect(after.drivers[0]).toMatchObject({
        outstandingOwedByDriver: 0,
        outstandingOwedToDriver: 0,
        cashDriverShouldHold: 50, // exactly the float, ready for tomorrow
      });
      expect(after.drivers[0]?.flags).not.toContain('UNALLOCATED_HANDOVER');
      expect(await cashModel.countDocuments({ driverId, status: 'HANDED_OVER' })).toBe(3);
    }, 60_000);

    it('keeps excess cash on the batch and flags it, never drops it', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());
      await service.onDelivered(orderId.toString(), driverId.toString(), 14);

      const batch = await service.recordHandover({
        driverId: driverId.toString(),
        amount: 5,
        receivedBy: admin.toString(),
      });

      expect(batch.unallocated).toBe(4.2);
      const report = await service.reconciliation({ driverId: driverId.toString() });
      expect(report.drivers[0]?.flags).toContain('UNALLOCATED_HANDOVER');
    });

    it('flags a delivery collected from the merchant and never resolved', async () => {
      // A collected order is never auto-released (the merchant was paid from the
      // float, the food is with the driver), so an admin must see it instead.
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());
      await cashModel.updateOne(
        { orderId },
        { $set: { paidToMerchantAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      );

      const report = await service.reconciliation({ driverId: driverId.toString() });

      expect(report.drivers[0]?.flags).toContain('STALE_UNDELIVERED');
    });

    it('cannot return more float than the driver holds', async () => {
      const d = new Types.ObjectId().toString();
      await service.moveFloat({
        driverId: d,
        type: 'ISSUED',
        amount: 20,
        actorId: admin.toString(),
      });

      await expect(
        service.moveFloat({ driverId: d, type: 'RETURNED', amount: 25, actorId: admin.toString() }),
      ).rejects.toThrow();
      expect(await floatModel.countDocuments({ driverId: new Types.ObjectId(d) })).toBe(1);
    });

    it('never allocates the same cash twice under concurrent handovers', async () => {
      const driverId = new Types.ObjectId();
      const est = await establishment(0);
      const orderId = await assignedOrder({
        driverId,
        establishmentId: est,
        method: 'pay_on_delivery',
        subtotal: 10,
      });
      await service.onMerchantPickup(orderId.toString(), driverId.toString());
      await service.onDelivered(orderId.toString(), driverId.toString(), 14);

      await Promise.allSettled([
        service.recordHandover({
          driverId: driverId.toString(),
          amount: 0.8,
          receivedBy: admin.toString(),
        }),
        service.recordHandover({
          driverId: driverId.toString(),
          amount: 0.8,
          receivedBy: admin.toString(),
        }),
      ]);

      const cash = await cashFor(orderId);
      expect(cash?.handedOverCash).toBe(0.8);
      expect(cash?.outstandingCash).toBe(0);
      // Whatever the second batch did, its cash is on record, not lost.
      const batches = await handoverModel.find({ driverId }).lean();
      const allocated = batches.flatMap(b => b.allocations).reduce((s, a) => s + a.amount, 0);
      const unallocated = batches.reduce((s, b) => s + b.unallocated, 0);
      expect(allocated).toBeCloseTo(0.8, 3);
      expect(allocated + unallocated).toBeCloseTo(0.8 * batches.length, 3);
    }, 60_000);
  });
});
