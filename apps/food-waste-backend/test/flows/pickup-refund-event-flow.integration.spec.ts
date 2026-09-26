/**
 * Pickup confirmation and the admin refund, end to end through the event bus,
 * against a real MongoDB replica set.
 *
 * The money these flows move is spread over three modules that only meet
 * through events: OrdersService.confirmPickup books the commission and emits
 * `order.completed`; the donations listener pledges 0.95% of the subtotal on
 * it; OrderManagementService.adminIssueRefund reverses the commission and
 * emits `order.refunded`, on which the listener takes the pledge back.
 *
 * Every hop here is the real code - OrdersService, OrderManagementService,
 * CommissionService, DonationsService, the donations OrderEventsListener, and
 * EventBusService routing through the EventEmitter2 adapter with RabbitMQ off,
 * which is how the in-process path runs. What is replaced: the Konnect wallet
 * and payout ledger (a separate provider-side concern, asserted as called),
 * the detail read each flow returns, caches, and logging.
 *
 * EventEmitter2.emit does not await async listeners, so production pledges
 * after the pickup response has returned. `settle()` waits for exactly the
 * listener calls the emitter fired, rather than sleeping.
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import { DonationGoalCategory, UserRole } from '@foodwaste/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { OrderManagementService } from '../../src/admin/services/order-management.service';
import { OrderCompletedEvent, OrderRefundedEvent } from '../../src/common/events';
import { EventEmitter2Adapter } from '../../src/common/services/event-bus/adapters/eventemitter2.adapter';
import { EventBusService } from '../../src/common/services/event-bus/event-bus.service';
import { DonationsService } from '../../src/donations/donations.service';
import { OrderEventsListener } from '../../src/donations/listeners/order-events.listener';
import {
  DonationPoolSchema,
  DonationPoolStatus,
  type DonationPoolDocument,
} from '../../src/donations/schemas/donation-pool.schema';
import {
  DonationPoolSnapshotSchema,
  type DonationPoolSnapshotDocument,
} from '../../src/donations/schemas/donation-pool-snapshot.schema';
import {
  UserDonationSchema,
  type UserDonationDocument,
} from '../../src/donations/schemas/user-donation.schema';
import {
  EstablishmentSchema,
  type EstablishmentDocument,
} from '../../src/establishments/schemas/establishment.schema';
import { OfferSchema, type OfferDocument } from '../../src/offers/schemas/offer.schema';
import {
  CommissionLedgerSchema,
  CommissionLedgerType,
  type CommissionLedgerDocument,
} from '../../src/payments/schemas/commission-ledger.schema';
import {
  PaymentSchema,
  PaymentStatus,
  type PaymentDocument,
} from '../../src/payments/schemas/payment.schema';
import {
  PlatformTransactionSchema,
  type PlatformTransactionDocument,
} from '../../src/payments/schemas/platform-transaction.schema';
import {
  RefundRequestSchema,
  type RefundRequestDocument,
} from '../../src/payments/schemas/refund-request.schema';
import { CommissionService } from '../../src/payments/services/commission.service';
import { requireMongoTestUri } from '../helpers/mongo-test-uri';
import { OrdersService } from '../../src/orders/order.service';
import {
  OrderSchema,
  OrderStatus,
  type OrderDocument,
} from '../../src/orders/schemas/order.schema';

const MONGO_URI = requireMongoTestUri();

/** 10 TND of food: commission 1.9, pledge 10 * 0.19 * 0.05. */
const SUBTOTAL = 10;
const PLEDGE = 0.095;
const PICKUP_CODE = '482913';

const noopLogger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });

describe('Pickup and admin refund - events, commission and charity against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let offerModel: Model<OfferDocument>;
  let paymentModel: Model<PaymentDocument>;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let platformTxModel: Model<PlatformTransactionDocument>;
  let poolModel: Model<DonationPoolDocument>;
  let snapshotModel: Model<DonationPoolSnapshotDocument>;
  let donationModel: Model<UserDonationDocument>;

  let orders: OrdersService;
  let admin: OrderManagementService;
  let emitter: EventEmitter2;
  let emitted: string[];
  let pending: Promise<void>[];
  let listener: OrderEventsListener;
  /** When set, order.completed events are parked here instead of handled. */
  let held: OrderCompletedEvent[] | null;
  let payout: { findByOrderId: jest.Mock; createLedgerEntry: jest.Mock };
  let konnect: { processPickupConfirmation: jest.Mock; processRefundRequest: jest.Mock };

  const AUDIT = {
    adminId: new Types.ObjectId().toString(),
    adminEmail: 'admin@toofreshtowaste.com',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  /** Waits for every listener call the emitter fired so far. */
  const settle = async (): Promise<void> => {
    const inFlight = pending.splice(0);
    await Promise.all(inFlight);
  };

  const balanceOf = async (id: Types.ObjectId) =>
    (await establishmentModel.findById(id).select('commissionDue').lean())?.commissionDue ?? 0;
  const pooled = async () => (await poolModel.findOne({}).lean())?.currentAmount;
  const netOf = async (orderId: Types.ObjectId, type: string) => {
    const rows = await platformTxModel.find({ orderId, type }).lean();
    return parseFloat(rows.reduce((sum, r) => sum + r.amount, 0).toFixed(3));
  };

  /** An order ready at the counter, with the users, establishment and offer it points to. */
  const readyOrder = async (
    kind: 'cash' | 'online',
    status = OrderStatus.READY_FOR_PICKUP,
    commissionDue = 0,
  ) => {
    const orderId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const merchantId = new Types.ObjectId();
    const establishmentId = new Types.ObjectId();
    const offerId = new Types.ObjectId();

    await connection.collection('users').insertMany([
      { _id: customerId, firstName: 'Amel', email: `c-${orderId.toString()}@test.tn` },
      { _id: merchantId, firstName: 'Karim', email: `m-${orderId.toString()}@test.tn` },
    ]);
    await establishmentModel.collection.insertOne({
      _id: establishmentId,
      name: 'Boulangerie Test',
      ownerId: merchantId,
      commissionDue,
    } as never);
    await offerModel.collection.insertOne({
      _id: offerId,
      title: 'Panier surprise',
      reservedQuantity: 1,
      soldQuantity: 0,
    } as never);

    const online = kind === 'online';
    await orderModel.collection.insertOne({
      _id: orderId,
      orderNumber: `ORD-${orderId.toString().slice(-8)}`,
      customerId,
      merchantId,
      establishmentId,
      status,
      deliveryMode: 'pickup',
      ...(online ? { paymentProvider: 'konnect' } : {}),
      paymentStatus: online ? 'held' : 'pending',
      paymentDetails: {
        method: online ? 'card' : 'cash_on_pickup',
        amount: SUBTOTAL,
        currency: 'TND',
      },
      paymentControl: online
        ? { controlledBy: 'TFTW', collector: 'PAYMENT_GATEWAY' }
        : { controlledBy: 'MERCHANT', collector: 'MERCHANT' },
      pricing: {
        subtotal: SUBTOTAL,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 0,
        total: SUBTOTAL,
        currency: 'TND',
      },
      items: [
        {
          offerId,
          offerTitle: 'Panier surprise',
          quantity: 1,
          unitPrice: SUBTOTAL,
          originalPrice: SUBTOTAL * 2,
          discountAmount: SUBTOTAL,
          totalPrice: SUBTOTAL,
        },
      ],
      pickupDetails: {
        pickupCode: PICKUP_CODE,
        qrCode: `QR-${orderId.toString()}`,
        scheduledDate: new Date(),
        timeSlot: { startTime: '18:00', endTime: '19:00' },
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as never);

    if (online) {
      await paymentModel.collection.insertOne({
        merchantTransactionId: `KON-${orderId.toString()}`,
        orderId,
        customerId,
        establishmentId,
        merchantId,
        status: PaymentStatus.HELD,
        paymentMethod: 'visa',
        currency: 'TND',
        amount: SUBTOTAL,
        refundedAmount: 0,
        processingFee: 0,
      } as never);
    }

    return { orderId, customerId, establishmentId, offerId };
  };

  const pickUp = async (
    orderId: Types.ObjectId,
    customerId: Types.ObjectId,
    code = PICKUP_CODE,
  ) => {
    await orders.confirmPickup(
      orderId.toString(),
      { pickupCode: code } as never,
      customerId.toString(),
      UserRole.CONSUMER,
    );
    await settle();
  };

  const refund = async (orderId: Types.ObjectId, reason: string) => {
    await admin.adminIssueRefund(orderId.toString(), { reason } as never, AUDIT);
    await settle();
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `pickup_refund_flow_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    const model = <T>(name: string, schema: mongoose.Schema) =>
      connection.model(name, schema) as unknown as Model<T>;
    orderModel = model<OrderDocument>('Order', OrderSchema);
    offerModel = model<OfferDocument>('Offer', OfferSchema);
    paymentModel = model<PaymentDocument>('Payment', PaymentSchema);
    establishmentModel = model<EstablishmentDocument>('Establishment', EstablishmentSchema);
    ledgerModel = model<CommissionLedgerDocument>('CommissionLedger', CommissionLedgerSchema);
    platformTxModel = model<PlatformTransactionDocument>(
      'PlatformTransaction',
      PlatformTransactionSchema,
    );
    poolModel = model<DonationPoolDocument>('DonationPool', DonationPoolSchema);
    snapshotModel = model<DonationPoolSnapshotDocument>(
      'DonationPoolSnapshot',
      DonationPoolSnapshotSchema,
    );
    donationModel = model<UserDonationDocument>('UserDonation', UserDonationSchema);
    const refundRequestModel = model<RefundRequestDocument>('RefundRequest', RefundRequestSchema);

    // Collections must exist before a transaction writes to them.
    await Promise.all(
      [
        orderModel,
        offerModel,
        paymentModel,
        establishmentModel,
        ledgerModel,
        platformTxModel,
        poolModel,
        snapshotModel,
        donationModel,
        refundRequestModel,
      ].map(async m => {
        await m.createCollection();
        await m.syncIndexes();
      }),
    );

    const commission = Object.create(CommissionService.prototype) as CommissionService;
    Object.assign(commission, {
      establishmentModel,
      ledgerModel,
      orderModel,
      platformTxModel,
      configService: {
        get: (key: string) =>
          key === 'COMMISSION_MODEL_EFFECTIVE_AT' ? '2026-01-01T00:00:00+01:00' : undefined,
      },
      logger: noopLogger(),
    });

    const donations = Object.create(DonationsService.prototype) as DonationsService;
    Object.assign(donations, {
      donationPoolModel: poolModel,
      snapshotModel,
      userDonationModel: donationModel,
      platformTxModel,
      donationsQueue: { add: jest.fn().mockResolvedValue(undefined) },
      cronLock: { runExclusive: jest.fn() },
      logger: noopLogger(),
    });

    // The real listener, subscribed the way @OnEvent subscribes it.
    listener = new OrderEventsListener(donations, orderModel);
    emitter = new EventEmitter2();
    emitted = [];
    pending = [];
    emitter.on('order.completed', (event: OrderCompletedEvent) => {
      emitted.push('order.completed');
      if (held) {
        held.push(event);
        return;
      }
      pending.push(listener.handleOrderCompletedLegacy(event));
    });
    emitter.on('order.refunded', (event: OrderRefundedEvent) => {
      emitted.push('order.refunded');
      pending.push(listener.handleOrderRefundedLegacy(event));
    });
    const eventBus = new EventBusService(
      { emit: jest.fn() } as never, // RabbitMQ: must never be reached with it disabled
      new EventEmitter2Adapter(emitter),
      { get: (_key: string, fallback?: string) => fallback } as never,
    );

    payout = {
      findByOrderId: jest.fn().mockResolvedValue(null),
      createLedgerEntry: jest.fn().mockResolvedValue(undefined),
    };
    konnect = {
      processPickupConfirmation: jest.fn().mockResolvedValue(undefined),
      processRefundRequest: jest.fn().mockResolvedValue(undefined),
    };

    orders = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(orders, {
      orderModel,
      offerModel,
      paymentModel,
      commissionService: commission,
      payoutService: payout,
      konnectOrderService: konnect,
      eventBus,
      appLogger: noopLogger(),
      cacheService: { delByPrefix: jest.fn().mockResolvedValue(undefined) },
      MAX_FAILED_PICKUP_ATTEMPTS: 5,
    });

    admin = Object.create(OrderManagementService.prototype) as OrderManagementService;
    Object.assign(admin, {
      orderModel,
      refundRequestModel,
      commissionService: commission,
      konnectOrderService: konnect,
      auditService: { createAuditLog: jest.fn().mockResolvedValue(undefined) },
      eventBus,
      logger: noopLogger(),
      // The detail view is a separate read with its own population; not under test.
      getOrderDetail: jest.fn().mockResolvedValue({}),
    });
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    emitted.length = 0;
    pending.length = 0;
    held = null;
    jest.clearAllMocks();
    payout.findByOrderId.mockResolvedValue(null);
    await Promise.all([
      poolModel.deleteMany({}),
      snapshotModel.deleteMany({}),
      donationModel.collection.deleteMany({}),
    ]);
    await poolModel.create({
      currentAmount: 0,
      targetAmount: 1000,
      mealCount: 0,
      status: DonationPoolStatus.ACTIVE,
      activeGoalCategory: DonationGoalCategory.TSHIRTS,
      startDate: new Date(),
      season: 1,
      goalIndex: 0,
      isArchived: false,
    });
    await snapshotModel.create({
      category: DonationGoalCategory.TSHIRTS,
      totalAmount: 0,
      totalItems: 0,
      percent: 0,
      targetAmount: 1000,
      itemPrice: 10,
      targetCount: 100,
    });
  });

  describe('pickup confirmation', () => {
    it('completes a cash pickup: paid, stock sold, 19% accrued, and the charity pledged', async () => {
      const { orderId, customerId, establishmentId, offerId } = await readyOrder('cash');

      await pickUp(orderId, customerId);

      const order = await orderModel.findById(orderId).lean();
      expect(order?.status).toBe(OrderStatus.PICKED_UP);
      expect(order?.paymentStatus).toBe('paid');
      expect(order?.pickedUpAt).toBeInstanceOf(Date);
      const offer = await offerModel.findById(offerId).lean();
      expect([offer?.reservedQuantity, offer?.soldQuantity]).toEqual([0, 1]);
      expect(await balanceOf(establishmentId)).toBe(1.9);
      expect(emitted).toEqual(['order.completed']);
      expect(await donationModel.countDocuments({ orderId })).toBe(1);
      expect(await pooled()).toBe(PLEDGE);
      expect(await netOf(orderId, 'DONATION')).toBe(PLEDGE);
      // A cash sale: the merchant already holds the money, TFTW owes nothing.
      expect(payout.createLedgerEntry).not.toHaveBeenCalled();
    });

    it('completes an online pickup: payment earned, merchant owed through the payout ledger, charity pledged', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder('online');

      await pickUp(orderId, customerId);

      expect((await orderModel.findById(orderId).lean())?.status).toBe(OrderStatus.COMPLETED);
      expect((await paymentModel.findOne({ orderId }).lean())?.status).toBe(PaymentStatus.EARNED);
      // NORMAL: the merchant is owed the full food price and the 19% goes on
      // their balance.
      expect(payout.createLedgerEntry).toHaveBeenCalledTimes(1);
      expect(await balanceOf(establishmentId)).toBe(1.9);
      expect(konnect.processPickupConfirmation).toHaveBeenCalledTimes(1);
      expect(await netOf(orderId, 'COMMISSION_EARNED')).toBe(1.9);
      expect(emitted).toEqual(['order.completed']);
      expect(await pooled()).toBe(PLEDGE);
    });

    // The case where the real decision and the no-decision fallback (100% to
    // the merchant) differ: TFTW holds the money and the merchant owes >= 5 TND,
    // so the balance is collected from this sale's proceeds.
    it('settles an owing merchant from an online pickup, and pays out only the rest', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder(
        'online',
        OrderStatus.READY_FOR_PICKUP,
        6,
      );

      await pickUp(orderId, customerId);

      expect(payout.createLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          commissionSettlement: { merchantAmount: 4, settled: 6 },
        }),
        expect.anything(),
      );
      expect(await balanceOf(establishmentId)).toBe(0);
      expect((await orderModel.findById(orderId).lean())?.commission?.kind).toBe('SETTLEMENT');
    });

    it('a wrong code completes nothing, emits nothing and pledges nothing', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder('cash');

      await expect(pickUp(orderId, customerId, '000000')).rejects.toThrow();

      const order = await orderModel.findById(orderId).lean();
      expect(order?.status).toBe(OrderStatus.READY_FOR_PICKUP);
      expect(order?.failedPickupAttempts).toBe(1);
      expect(await balanceOf(establishmentId)).toBe(0);
      expect(emitted).toEqual([]);
      expect(await donationModel.countDocuments({ orderId })).toBe(0);
    });

    it('a second confirmation is refused and pledges nothing more', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder('cash');
      await pickUp(orderId, customerId);

      await expect(pickUp(orderId, customerId)).rejects.toThrow();

      expect(await balanceOf(establishmentId)).toBe(1.9);
      expect(emitted).toEqual(['order.completed']);
      expect(await pooled()).toBe(PLEDGE);
    });

    it('locks after five wrong codes, then refuses even the right one', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder('cash');
      for (let i = 0; i < 5; i++) {
        await expect(pickUp(orderId, customerId, '000000')).rejects.toThrow();
      }
      expect((await orderModel.findById(orderId).lean())?.pickupLocked).toBe(true);

      await expect(pickUp(orderId, customerId)).rejects.toThrow(/locked/i);

      expect((await orderModel.findById(orderId).lean())?.status).toBe(
        OrderStatus.READY_FOR_PICKUP,
      );
      expect(await balanceOf(establishmentId)).toBe(0);
      expect(emitted).toEqual([]);
    });

    it('a cancelled order cannot be picked up', async () => {
      const { orderId, customerId } = await readyOrder('cash', OrderStatus.CANCELLED);

      await expect(pickUp(orderId, customerId)).rejects.toThrow(/ready/i);
      expect(emitted).toEqual([]);
    });
  });

  describe('refund after completion', () => {
    it('in person (cash): the commission and the pledge both come back', async () => {
      const { orderId, customerId, establishmentId } = await readyOrder('cash');
      await pickUp(orderId, customerId);

      await refund(orderId, 'Customer returned the bag');

      expect((await orderModel.findById(orderId).lean())?.status).toBe(OrderStatus.REFUNDED);
      expect(await balanceOf(establishmentId)).toBe(0);
      expect(
        await ledgerModel.countDocuments({ orderId, type: CommissionLedgerType.REVERSAL }),
      ).toBe(1);
      expect(emitted).toEqual(['order.completed', 'order.refunded']);
      expect(await pooled()).toBe(0);
      expect(await netOf(orderId, 'DONATION')).toBe(0);
      // Reversed, not deleted: hidden from reads, still there for audit.
      expect(await donationModel.find({ orderId })).toHaveLength(0);
      const kept = await donationModel.find({ orderId }).setOptions({ includeDeleted: true });
      expect(kept).toHaveLength(1);
    });

    it('online (Konnect): refund requested, revenue netted to zero, and the pledge taken back', async () => {
      const { orderId, customerId } = await readyOrder('online');
      await pickUp(orderId, customerId);

      await refund(orderId, 'Spoiled');

      const order = await orderModel.findById(orderId).lean();
      expect(order?.status).toBe(OrderStatus.REFUNDED);
      expect(order?.paymentStatus).toBe('refund_pending');
      expect(order?.refundReason).toBe('[Admin] Spoiled');
      expect(konnect.processRefundRequest).toHaveBeenCalledTimes(1);
      expect(await netOf(orderId, 'COMMISSION_EARNED')).toBe(0);
      expect(emitted).toEqual(['order.completed', 'order.refunded']);
      expect(await pooled()).toBe(0);
      expect(await netOf(orderId, 'DONATION')).toBe(0);
    });

    it('online: a second refund is refused and reverses nothing twice', async () => {
      const { orderId, customerId } = await readyOrder('online');
      await pickUp(orderId, customerId);
      await refund(orderId, 'first');

      await expect(refund(orderId, 'again')).rejects.toThrow();

      expect(konnect.processRefundRequest).toHaveBeenCalledTimes(1);
      expect(await netOf(orderId, 'COMMISSION_EARNED')).toBe(0);
      expect(emitted).toEqual(['order.completed', 'order.refunded']);
      expect(await pooled()).toBe(0);
    });

    // RabbitMQ can deliver order.completed after order.refunded (a redelivery,
    // a slow consumer). The refund then finds no pledge to reverse, so the late
    // completion must not book one.
    it('a completion handled after the refund never leaves a pledge', async () => {
      const { orderId, customerId } = await readyOrder('cash');
      held = [];
      await pickUp(orderId, customerId);
      const [late] = held;
      held = null;
      await refund(orderId, 'refunded at the counter');

      if (!late) {
        throw new Error('pickup emitted no order.completed');
      }
      await listener.handleOrderCompletedLegacy(late);

      expect(await pooled()).toBe(0);
      expect(await donationModel.countDocuments({ orderId })).toBe(0);
      expect(await netOf(orderId, 'DONATION')).toBe(0);
    });
  });
});
