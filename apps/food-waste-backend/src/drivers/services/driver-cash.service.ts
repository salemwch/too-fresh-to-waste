import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types, isValidObjectId } from 'mongoose';

import { CommissionService } from '../../payments/services/commission.service';
import { Payment, PaymentDocument, PaymentStatus } from '../../payments/schemas/payment.schema';
import { Order, OrderDocument, OrderStatus } from '../../orders/schemas/order.schema';
import {
  DriverCashHandover,
  DriverCashHandoverDocument,
} from '../schemas/driver-cash-handover.schema';
import {
  DriverDeliveryCash,
  DriverDeliveryCashDocument,
} from '../schemas/driver-delivery-cash.schema';
import {
  DriverFloatMovement,
  DriverFloatMovementDocument,
} from '../schemas/driver-float-movement.schema';
import {
  allocateHandover,
  buildMerchantPickupCash,
  recordCollection,
  recordFailure,
  resolveRecovery,
  type DeliveryCashFigures,
  type DeliveryPaymentMethod,
} from '../utils/driver-cash.util';

import { appError } from '../../common/errors';
export type DeliveryFailureReason =
  | 'CUSTOMER_REFUSED'
  | 'CUSTOMER_UNREACHABLE'
  | 'CUSTOMER_UNAVAILABLE'
  | 'MERCHANT_FAULT'
  | 'DRIVER_FAULT';

export type DeliveryRecovery = 'RECOVERABLE_PENDING' | 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';

const FAULT_PARTY: Readonly<Record<DeliveryFailureReason, 'CUSTOMER' | 'MERCHANT' | 'DRIVER'>> =
  Object.freeze({
    CUSTOMER_REFUSED: 'CUSTOMER',
    CUSTOMER_UNREACHABLE: 'CUSTOMER',
    CUSTOMER_UNAVAILABLE: 'CUSTOMER',
    MERCHANT_FAULT: 'MERCHANT',
    DRIVER_FAULT: 'DRIVER',
  });

/** A COLLECTED record older than this is flagged in reconciliation. */
const STALE_COLLECTION_HOURS = 24;

const round3 = (value: number): number => parseFloat(value.toFixed(3));

export interface DriverInstruction {
  payMerchant: number;
  collectFromCustomer: number;
  driverKeeps: number;
  frozenAt: Date;
}

/**
 * Every money movement of a delivery, and the cash reconciliation between TFTW
 * and its drivers. Model: `.claude/work/commission-settlement-model.md`
 * ("Final decisions for delivery", "Driver cash", "Failed deliveries");
 * arithmetic: `drivers/utils/driver-cash.util.ts`.
 *
 * Each lifecycle step is ONE transaction: the status claim, the commission
 * decision, the cash record and the frozen driver instruction commit together
 * or not at all. The status filter on the claim is what makes a retried or
 * concurrent request a no-op rather than a second payment.
 */
@Injectable()
export class DriverCashService {
  private readonly logger = new Logger(DriverCashService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(DriverDeliveryCash.name)
    private readonly cashModel: Model<DriverDeliveryCashDocument>,
    @InjectModel(DriverCashHandover.name)
    private readonly handoverModel: Model<DriverCashHandoverDocument>,
    @InjectModel(DriverFloatMovement.name)
    private readonly floatModel: Model<DriverFloatMovementDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly commissionService: CommissionService,
  ) {}

  private async inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Who collects at the door. Stored at creation for new orders
   * (`paymentControl`); the fallback reads the stored method only for a
   * delivery created before that field existed, where it is the same record.
   */
  private deliveryMethod(order: OrderDocument): DeliveryPaymentMethod {
    if (order.paymentControl) {
      return order.paymentControl.collector === 'PAYMENT_GATEWAY' ? 'online' : 'pay_on_delivery';
    }
    return order.paymentProvider === 'konnect' ? 'online' : 'pay_on_delivery';
  }

  // ─── 1. Merchant pickup: decide, freeze, pay the merchant ─────────────────

  /**
   * DRIVER_ASSIGNED -> OUT_FOR_DELIVERY. Decides NORMAL / SETTLEMENT, freezes
   * every figure the driver needs, and records the merchant payment from the
   * float - once. The returned instruction is what the driver app shows.
   */
  async onMerchantPickup(
    orderId: string,
    driverId: string,
  ): Promise<{ order: OrderDocument; instruction: DriverInstruction }> {
    const result = await this.inTransaction(async session => {
      const now = new Date();
      const order = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.DRIVER_ASSIGNED,
        },
        { $set: { status: OrderStatus.OUT_FOR_DELIVERY, driverPickedUpAt: now } },
        { new: true, session },
      );
      if (!order) {
        throw new NotFoundException(appError('DRIVER_ORDER_NOT_YOURS'));
      }

      /*
       * Delivery is never on the pre-cutoff engine's path (it only ever ran
       * for online pickups), so `legacyEligible` is false: before the cutoff
       * this returns null and the order is NORMAL at the full subtotal.
       */
      const commission = await this.commissionService.applyForOrder(
        {
          establishmentId: order.establishmentId as Types.ObjectId,
          merchantId: order.merchantId as Types.ObjectId,
          orderId: order._id,
          subtotal: order.pricing.subtotal,
          controlledBy: order.paymentControl?.controlledBy,
          appliedAt: now,
          legacyEligible: false,
        },
        session,
      );

      const cash = buildMerchantPickupCash({
        paymentMethod: this.deliveryMethod(order),
        subtotal: order.pricing.subtotal,
        total: order.pricing.total,
        deliveryFee: order.pricing.deliveryFee,
        driverEarnings: order.driverEarnings ?? 0,
        platformDeliveryCommission: order.platformDeliveryCommission ?? 0,
        commission: commission ?? {
          kind: 'NORMAL',
          settled: 0,
          merchantAmount: order.pricing.subtotal,
        },
      });

      const { instruction: figures, ...record } = cash;
      await this.cashModel.create(
        [
          {
            ...record,
            orderId: order._id,
            driverId: new Types.ObjectId(driverId),
            establishmentId: order.establishmentId,
            paidToMerchantAt: now,
          },
        ],
        { session },
      );

      const instruction: DriverInstruction = { ...figures, frozenAt: now };
      await this.orderModel.updateOne(
        { _id: order._id, driverInstruction: { $exists: false } },
        { $set: { driverInstruction: instruction } },
        { session },
      );
      order.driverInstruction = instruction;

      return { order, instruction };
    });

    return result;
  }

  // ─── 2. Delivery: record what the customer paid ───────────────────────────

  /**
   * OUT_FOR_DELIVERY -> DELIVERED, with the cash the driver confirms. An app
   * that does not send the amount is accepted for compatibility, but the
   * record says so (`collectionConfirmedByDriver: false`) and reconciliation
   * flags it - an assumed collection is not money TFTW has.
   */
  async onDelivered(
    orderId: string,
    driverId: string,
    collectedCash?: number,
  ): Promise<OrderDocument> {
    const order = await this.inTransaction(async session => {
      const delivered = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
        { $set: { status: OrderStatus.DELIVERED, deliveredAt: new Date() } },
        { new: true, session },
      );
      if (!delivered) {
        throw new NotFoundException(appError('DRIVER_ORDER_NOT_YOURS'));
      }

      const record = await this.cashModel
        .findOne({ orderId: delivered._id, status: 'EXPECTED' })
        .session(session);

      if (!record) {
        // Picked up before driver cash existed: nothing to reconcile.
        this.logger.warn(`No driver cash record for delivered order ${orderId}`);
      } else {
        const confirmed = collectedCash !== undefined;
        let resolved;
        try {
          resolved = recordCollection(
            record.toObject() as DeliveryCashFigures,
            confirmed ? collectedCash : record.expectedCash,
          );
        } catch (error) {
          throw new BadRequestException(appError('DRIVER_CASH_MISMATCH'), { cause: error });
        }
        await this.cashModel.updateOne(
          { _id: record._id, status: 'EXPECTED' },
          {
            $set: {
              collectedCash: resolved.collectedCash,
              collectionConfirmedByDriver: confirmed,
              shortfall: resolved.shortfall,
              dueToTftw: resolved.dueToTftw,
              outstandingCash: resolved.outstandingCash,
              status: resolved.status,
              collectedAt: new Date(),
            },
          },
          { session },
        );
      }

      // TFTW has now earned the online payment for this order. No payout
      // entry: the driver already paid the merchant at pickup.
      await this.paymentModel.updateOne(
        { orderId: delivered._id, status: PaymentStatus.HELD },
        { $set: { status: PaymentStatus.EARNED, earnedAt: new Date() } },
        { session },
      );

      return delivered;
    });

    return order;
  }

  // ─── 3. Failed delivery ───────────────────────────────────────────────────

  async onFailed(
    orderId: string,
    driverId: string,
    input: { reason: DeliveryFailureReason; recovery: DeliveryRecovery; notes?: string },
  ): Promise<OrderDocument> {
    const faultParty = FAULT_PARTY[input.reason];
    if (faultParty === 'MERCHANT' && input.recovery !== 'RETURNED_TO_MERCHANT') {
      throw new BadRequestException(appError('DRIVER_MERCHANT_FAULT_RETURN'));
    }

    const order = await this.inTransaction(async session => {
      const now = new Date();
      const failed = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
        {
          $set: {
            status: OrderStatus.CANCELLED,
            cancelledAt: now,
            deliveryFailure: {
              reason: input.reason,
              faultParty,
              recovery: input.recovery,
              ...(input.notes ? { notes: input.notes } : {}),
              recordedAt: now,
              recordedBy: new Types.ObjectId(driverId),
            },
          },
        },
        { new: true, session },
      );
      if (!failed) {
        throw new NotFoundException(appError('DRIVER_ORDER_NOT_YOURS'));
      }

      const record = await this.cashModel
        .findOne({ orderId: failed._id, status: 'EXPECTED' })
        .session(session);
      if (record) {
        const resolved = recordFailure(record.toObject() as DeliveryCashFigures, {
          faultParty,
          recovery: input.recovery,
        });
        await this.cashModel.updateOne(
          { _id: record._id, status: 'EXPECTED' },
          {
            $set: {
              collectedCash: 0,
              merchantReturnedCash: resolved.merchantReturnedCash,
              driverKeeps: resolved.driverKeeps,
              dueToTftw: resolved.dueToTftw,
              outstandingCash: resolved.outstandingCash,
              lossAmount: resolved.lossAmount,
              status: 'FAILED',
              recovery: input.recovery,
            },
          },
          { session },
        );
      }

      if (input.recovery === 'RETURNED_TO_MERCHANT') {
        await this.undoSale(failed, session);
      }

      return failed;
    });

    return order;
  }

  /**
   * Admin, later: what happened to food left RECOVERABLE_PENDING.
   */
  async resolveFailedRecovery(
    orderId: string,
    recovery: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE',
  ): Promise<void> {
    await this.inTransaction(async session => {
      const order = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          'deliveryFailure.recovery': 'RECOVERABLE_PENDING',
        },
        { $set: { 'deliveryFailure.recovery': recovery } },
        { new: true, session },
      );
      if (!order) {
        throw new NotFoundException(appError('DRIVER_NO_PENDING_RECOVERY'));
      }

      const record = await this.cashModel
        .findOne({ orderId: order._id, status: 'FAILED' })
        .session(session);
      if (record) {
        const resolved = resolveRecovery(
          { ...(record.toObject() as DeliveryCashFigures), recovery: 'RECOVERABLE_PENDING' },
          recovery,
        );
        await this.cashModel.updateOne(
          { _id: record._id, merchantReturnedCash: 0, lossAmount: 0 },
          {
            $set: {
              recovery,
              merchantReturnedCash: resolved.merchantReturnedCash,
              dueToTftw: resolved.dueToTftw,
              outstandingCash: resolved.outstandingCash,
              lossAmount: resolved.lossAmount,
            },
          },
          { session },
        );
      }

      if (recovery === 'RETURNED_TO_MERCHANT') {
        await this.undoSale(order, session);
      }
    });
  }

  /** The merchant took the food back: the sale, and its commission, never happened. */
  private async undoSale(order: OrderDocument, session: ClientSession): Promise<void> {
    await this.commissionService.reverseForOrder(
      {
        establishmentId: order.establishmentId as Types.ObjectId,
        merchantId: order.merchantId as Types.ObjectId,
        orderId: order._id,
        subtotal: order.pricing.subtotal,
      },
      1,
      session,
    );
  }

  // ─── 4. Float and handovers (admin) ───────────────────────────────────────

  async moveFloat(input: {
    driverId: string;
    type: 'ISSUED' | 'RETURNED';
    amount: number;
    actorId: string;
    reason?: string;
  }): Promise<{ float: number }> {
    if (!isValidObjectId(input.driverId)) {
      throw new BadRequestException(appError('DRIVER_UNKNOWN'));
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException(appError('AMOUNT_ABOVE_ZERO'));
    }

    const float = await this.inTransaction(async session => {
      const current = await this.currentFloat(input.driverId, session);
      if (input.type === 'RETURNED' && input.amount > current) {
        throw new BadRequestException(
          appError('DRIVER_FLOAT_INSUFFICIENT', { amount: String(current.toFixed(3)) }),
        );
      }
      await this.floatModel.create(
        [
          {
            driverId: new Types.ObjectId(input.driverId),
            type: input.type,
            amount: round3(input.amount),
            actorId: new Types.ObjectId(input.actorId),
            at: new Date(),
            ...(input.reason ? { reason: input.reason } : {}),
          },
        ],
        { session },
      );
      return round3(current + (input.type === 'ISSUED' ? input.amount : -input.amount));
    });

    return { float };
  }

  private async currentFloat(driverId: string, session?: ClientSession): Promise<number> {
    const rows = await this.floatModel
      .aggregate<{ _id: string; total: number }>([
        { $match: { driverId: new Types.ObjectId(driverId) } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ])
      .session(session ?? null);
    const issued = rows.find(r => r._id === 'ISSUED')?.total ?? 0;
    const returned = rows.find(r => r._id === 'RETURNED')?.total ?? 0;
    return round3(issued - returned);
  }

  /**
   * One counted handover. `amount > 0`: the driver handed TFTW cash.
   * `amount < 0`: TFTW paid the driver (float replenishment and the driver's
   * share on online deliveries). Allocated oldest first; the remainder is
   * recorded on the batch, never dropped.
   */
  async recordHandover(input: {
    driverId: string;
    amount: number;
    receivedBy: string;
    notes?: string;
  }): Promise<DriverCashHandoverDocument> {
    if (!isValidObjectId(input.driverId)) {
      throw new BadRequestException(appError('DRIVER_UNKNOWN'));
    }
    if (!Number.isFinite(input.amount) || input.amount === 0) {
      throw new BadRequestException(appError('AMOUNT_REQUIRED'));
    }

    const batch = await this.inTransaction(async session => {
      const open = await this.cashModel
        .find({
          driverId: new Types.ObjectId(input.driverId),
          status: { $in: ['COLLECTED', 'SHORT', 'PARTIALLY_HANDED_OVER', 'FAILED'] },
          outstandingCash: { $ne: 0 },
        })
        .sort({ paidToMerchantAt: 1, _id: 1 })
        .session(session);

      const { allocations, unallocated } = allocateHandover(
        open.map(r => ({
          id: r._id.toString(),
          outstandingCash: r.outstandingCash,
          status: r.status,
        })),
        input.amount,
      );

      const batchId = randomUUID();
      const now = new Date();
      const byId = new Map(open.map(r => [r._id.toString(), r]));

      for (const allocation of allocations) {
        const before = byId.get(allocation.id);
        // Guarded on the outstanding amount read above, so a concurrent batch
        // can never allocate the same cash twice.
        const updated = await this.cashModel.updateOne(
          { _id: new Types.ObjectId(allocation.id), outstandingCash: before?.outstandingCash },
          {
            $set: {
              outstandingCash: allocation.outstandingAfter,
              status: allocation.status,
              handoverBatchId: batchId,
              ...(allocation.outstandingAfter === 0 ? { handedOverAt: now } : {}),
            },
            $inc: { handedOverCash: allocation.amount },
            $push: { handoverBatchIds: batchId },
          },
          { session },
        );
        if (updated.modifiedCount !== 1) {
          throw new BadRequestException(appError('DRIVER_CASH_CHANGED'));
        }
      }

      const [created] = await this.handoverModel.create(
        [
          {
            batchId,
            driverId: new Types.ObjectId(input.driverId),
            amount: round3(input.amount),
            receivedBy: new Types.ObjectId(input.receivedBy),
            receivedAt: now,
            allocations: allocations.map(a => ({
              orderId: byId.get(a.id)?.orderId,
              amount: a.amount,
            })),
            unallocated,
            ...(input.notes ? { notes: input.notes } : {}),
          },
        ],
        { session },
      );
      return created as DriverCashHandoverDocument;
    });

    return batch;
  }

  // ─── 5. Reconciliation (admin) ────────────────────────────────────────────

  async reconciliation(query: { from?: Date; to?: Date; driverId?: string } = {}) {
    const match: Record<string, unknown> = {};
    if (query.from || query.to) {
      match['paidToMerchantAt'] = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    if (query.driverId) {
      if (!isValidObjectId(query.driverId)) {
        throw new BadRequestException(appError('DRIVER_UNKNOWN'));
      }
      match['driverId'] = new Types.ObjectId(query.driverId);
    }

    const staleBefore = new Date(Date.now() - STALE_COLLECTION_HOURS * 60 * 60 * 1000);

    const drivers = await this.cashModel.aggregate<ReconciliationRow>([
      { $match: match },
      {
        $group: {
          _id: '$driverId',
          orders: { $sum: 1 },
          paidToMerchant: { $sum: '$paidToMerchant' },
          expectedCash: { $sum: '$expectedCash' },
          collectedCash: { $sum: { $ifNull: ['$collectedCash', 0] } },
          handedOverCash: { $sum: '$handedOverCash' },
          driverKeeps: { $sum: '$driverKeeps' },
          tftwDeliveryRevenue: { $sum: '$tftwDeliveryRevenue' },
          tftwSettlement: { $sum: '$tftwSettlement' },
          lossAmount: { $sum: '$lossAmount' },
          shortfall: { $sum: '$shortfall' },
          owedByDriver: {
            $sum: { $cond: [{ $gt: ['$outstandingCash', 0] }, '$outstandingCash', 0] },
          },
          owedToDriver: {
            $sum: { $cond: [{ $lt: ['$outstandingCash', 0] }, { $abs: '$outstandingCash' }, 0] },
          },
          shortCount: { $sum: { $cond: [{ $eq: ['$status', 'SHORT'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          awaitingDelivery: { $sum: { $cond: [{ $eq: ['$status', 'EXPECTED'] }, 1, 0] } },
          // Collected from the merchant, never delivered nor reported failed.
          staleUndelivered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'EXPECTED'] },
                    { $lt: ['$paidToMerchantAt', staleBefore] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          unconfirmedCollections: {
            $sum: { $cond: [{ $eq: ['$collectionConfirmedByDriver', false] }, 1, 0] },
          },
          staleCollections: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['COLLECTED', 'SHORT', 'PARTIALLY_HANDED_OVER']] },
                    { $lt: ['$collectedAt', staleBefore] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { owedByDriver: -1 } },
    ]);

    /*
     * Failed deliveries still waiting for a decision on the food. One query for
     * every driver in the report, grouped in memory - never one per driver.
     */
    const pending = await this.cashModel
      .find({ ...match, status: 'FAILED', recovery: 'RECOVERABLE_PENDING' })
      .select('orderId driverId paidToMerchant paymentMethod paidToMerchantAt')
      .sort({ paidToMerchantAt: 1 })
      .lean();
    const pendingByDriver = new Map<string, PendingRecovery[]>();
    for (const p of pending) {
      const key = p.driverId.toString();
      const list = pendingByDriver.get(key) ?? [];
      list.push({
        orderId: p.orderId.toString(),
        paidToMerchant: p.paidToMerchant,
        paymentMethod: p.paymentMethod,
        since: p.paidToMerchantAt,
      });
      pendingByDriver.set(key, list);
    }

    const rows = await Promise.all(
      drivers.map(async d => {
        const [float, unallocatedBatches] = await Promise.all([
          this.currentFloat(d._id.toString()),
          this.handoverModel.countDocuments({ driverId: d._id, unallocated: { $ne: 0 } }),
        ]);
        const r = (v: number) => round3(v);
        const flags: string[] = [];
        if (d.shortCount > 0) {
          flags.push('SHORT_COLLECTION');
        }
        if (d.unconfirmedCollections > 0) {
          flags.push('UNCONFIRMED_COLLECTION');
        }
        if (d.staleCollections > 0) {
          flags.push('STALE_COLLECTION');
        }
        if (d.staleUndelivered > 0) {
          flags.push('STALE_UNDELIVERED');
        }
        if (d.failedCount > 0) {
          flags.push('FAILED_DELIVERY');
        }
        if (unallocatedBatches > 0) {
          flags.push('UNALLOCATED_HANDOVER');
        }
        if (r(d.collectedCash) !== r(d.expectedCash) && d.awaitingDelivery === 0) {
          flags.push('EXPECTED_COLLECTED_MISMATCH');
        }
        return {
          driverId: d._id.toString(),
          orders: d.orders,
          expectedCash: r(d.expectedCash),
          collectedCash: r(d.collectedCash),
          handedOverCash: r(d.handedOverCash),
          outstandingOwedByDriver: r(d.owedByDriver),
          outstandingOwedToDriver: r(d.owedToDriver),
          paidToMerchant: r(d.paidToMerchant),
          foodMoneyCollected: r(
            Math.max(0, d.collectedCash - d.driverKeeps - d.tftwDeliveryRevenue),
          ),
          driverDeliveryEarnings: r(d.driverKeeps),
          tftwDeliveryRevenue: r(d.tftwDeliveryRevenue),
          tftwCommissionSettlement: r(d.tftwSettlement),
          lossAmount: r(d.lossAmount),
          shortfall: r(d.shortfall),
          float,
          /** What the driver should physically hold: TFTW's float + what they owe - what TFTW owes them. */
          cashDriverShouldHold: r(float + d.owedByDriver - d.owedToDriver),
          unallocatedHandovers: unallocatedBatches,
          pendingRecoveries: pendingByDriver.get(d._id.toString()) ?? [],
          flags,
        };
      }),
    );

    const sum = (key: keyof (typeof rows)[number]) =>
      round3(rows.reduce((total, row) => total + (row[key] as number), 0));

    return {
      window: { from: query.from ?? null, to: query.to ?? null },
      totals: {
        expectedCash: sum('expectedCash'),
        collectedCash: sum('collectedCash'),
        handedOverCash: sum('handedOverCash'),
        outstandingOwedByDriver: sum('outstandingOwedByDriver'),
        outstandingOwedToDriver: sum('outstandingOwedToDriver'),
        driverDeliveryEarnings: sum('driverDeliveryEarnings'),
        tftwDeliveryRevenue: sum('tftwDeliveryRevenue'),
        tftwCommissionSettlement: sum('tftwCommissionSettlement'),
        lossAmount: sum('lossAmount'),
      },
      drivers: rows,
    };
  }
}

/** A failed delivery whose food outcome an admin still has to decide. */
export interface PendingRecovery {
  orderId: string;
  paidToMerchant: number;
  paymentMethod: 'pay_on_delivery' | 'online';
  since: Date;
}

interface ReconciliationRow {
  _id: Types.ObjectId;
  orders: number;
  paidToMerchant: number;
  expectedCash: number;
  collectedCash: number;
  handedOverCash: number;
  driverKeeps: number;
  tftwDeliveryRevenue: number;
  tftwSettlement: number;
  lossAmount: number;
  shortfall: number;
  owedByDriver: number;
  owedToDriver: number;
  shortCount: number;
  failedCount: number;
  awaitingDelivery: number;
  staleUndelivered: number;
  unconfirmedCollections: number;
  staleCollections: number;
}
