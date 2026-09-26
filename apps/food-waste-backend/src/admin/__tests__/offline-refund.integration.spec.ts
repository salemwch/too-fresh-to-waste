/**
 * Refunding a sale TFTW did not collect online, against a real MongoDB.
 *
 * Before the commission-settlement model, the admin refund refused anything
 * but Konnect - harmless while cash sales carried no commission. They now
 * accrue 19% (or settle a balance), so a cash sale refunded in person must
 * undo that, or the merchant keeps owing commission on a sale that never
 * stood. "Refunds reverse both the accrual and any settlement" -
 * `.claude/work/commission-settlement-model.md`.
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
import {
  PlatformTransactionSchema,
  type PlatformTransactionDocument,
} from '../../payments/schemas/platform-transaction.schema';
import { CommissionService } from '../../payments/services/commission.service';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { OrderManagementService } from '../services/order-management.service';

const MONGO_URI = requireMongoTestUri();

describe('OrderManagementService offline refund — against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let establishmentModel: Model<EstablishmentDocument>;
  let ledgerModel: Model<CommissionLedgerDocument>;
  let commission: CommissionService;
  let service: OrderManagementService;
  let auditLog: jest.Mock;
  let emitEvent: jest.Mock;
  let platformTx: Model<PlatformTransactionDocument>;

  const AUDIT = {
    adminId: new Types.ObjectId().toString(),
    adminEmail: 'admin@toofreshtowaste.com',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  const balanceOf = async (id: Types.ObjectId) =>
    (await establishmentModel.findById(id).select('commissionDue').lean())?.commissionDue ?? 0;

  /** A completed sale whose commission was decided through the real path. */
  const completedSale = async (opts: {
    due: number;
    subtotal: number;
    method: 'cash_on_pickup' | 'pay_on_delivery';
    status: OrderStatus;
  }) => {
    const establishmentId = new Types.ObjectId();
    await establishmentModel.collection.insertOne({
      _id: establishmentId,
      name: 'Pâtisserie Test',
      ownerId: new Types.ObjectId(),
      commissionDue: opts.due,
    } as never);

    const orderId = new Types.ObjectId();
    const merchantId = new Types.ObjectId();
    const controlledBy = opts.method === 'cash_on_pickup' ? 'MERCHANT' : 'TFTW';
    await orderModel.collection.insertOne({
      _id: orderId,
      orderNumber: `ORD-${orderId.toString().slice(-8)}`,
      customerId: new Types.ObjectId(),
      merchantId,
      establishmentId,
      status: opts.status,
      deliveryMode: opts.method === 'pay_on_delivery' ? 'delivery' : 'pickup',
      paymentDetails: { method: opts.method, amount: opts.subtotal, currency: 'TND' },
      paymentControl: {
        controlledBy,
        collector: opts.method === 'cash_on_pickup' ? 'MERCHANT' : 'DRIVER',
      },
      pricing: {
        subtotal: opts.subtotal,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 0,
        total: opts.subtotal,
        currency: 'TND',
      },
      items: [],
      pickupDetails: {
        pickupCode: orderId.toString().slice(-6),
        qrCode: `QR-${orderId.toString()}`,
      },
    } as never);

    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        await commission.applyForOrder(
          {
            establishmentId,
            merchantId,
            orderId,
            subtotal: opts.subtotal,
            controlledBy,
            appliedAt: new Date(),
            legacyEligible: false,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    return { orderId, establishmentId };
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `offline_refund_${Date.now()}`,
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
    await ledgerModel.syncIndexes();

    const platformTxModel = connection.model('PlatformTransaction', PlatformTransactionSchema);
    await platformTxModel.syncIndexes();
    commission = Object.create(CommissionService.prototype) as CommissionService;
    Object.assign(commission, {
      establishmentModel,
      ledgerModel,
      orderModel,
      platformTxModel,
      configService: {
        get: (key: string) =>
          key === 'COMMISSION_MODEL_EFFECTIVE_AT' ? '2026-01-01T00:00:00+01:00' : undefined,
      },
      logger: { error: jest.fn(), log: jest.fn(), debug: jest.fn() },
    });

    auditLog = jest.fn().mockResolvedValue(undefined);
    emitEvent = jest.fn().mockResolvedValue(undefined);
    platformTx = platformTxModel as unknown as Model<PlatformTransactionDocument>;
    service = Object.create(OrderManagementService.prototype) as OrderManagementService;
    Object.assign(service, {
      orderModel,
      commissionService: commission,
      auditService: { createAuditLog: auditLog },
      eventBus: { emit: emitEvent },
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      // The detail view is a separate read with its own population; not under test.
      getOrderDetail: jest.fn().mockResolvedValue({}),
    });
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it('reverses the 19% a refunded cash pickup accrued', async () => {
    const { orderId, establishmentId } = await completedSale({
      due: 0,
      subtotal: 10,
      method: 'cash_on_pickup',
      status: OrderStatus.PICKED_UP,
    });
    expect(await balanceOf(establishmentId)).toBe(1.9);

    await service.adminIssueRefund(
      orderId.toString(),
      { reason: 'Customer returned the bag' } as never,
      AUDIT,
    );

    expect(await balanceOf(establishmentId)).toBe(0);
    const order = await orderModel.findById(orderId).lean();
    expect(order?.status).toBe(OrderStatus.REFUNDED);
    expect(order?.paymentStatus).toBe('refunded');
    expect(await ledgerModel.countDocuments({ orderId, type: CommissionLedgerType.REVERSAL })).toBe(
      1,
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ offline: true }) }),
    );
  });

  it('nets the platform revenue of the refunded sale to zero and tells the charity', async () => {
    const { orderId } = await completedSale({
      due: 0,
      subtotal: 10,
      method: 'cash_on_pickup',
      status: OrderStatus.PICKED_UP,
    });
    const earned = await platformTx.find({ orderId, type: 'COMMISSION_EARNED' }).lean();
    expect(earned.map(r => r.amount)).toEqual([1.9]);

    await service.adminIssueRefund(orderId.toString(), { reason: 'Spoiled' } as never, AUDIT);

    const after = await platformTx.find({ orderId, type: 'COMMISSION_EARNED' }).lean();
    expect(after.reduce((sum, r) => sum + r.amount, 0)).toBe(0);
    expect(emitEvent).toHaveBeenCalledWith(
      'order.refunded',
      expect.objectContaining({ orderId: orderId.toString(), reason: 'Spoiled' }),
    );
  });

  it('restores the debt a refunded pay-on-delivery settlement had paid', async () => {
    const { orderId, establishmentId } = await completedSale({
      due: 5,
      subtotal: 10,
      method: 'pay_on_delivery',
      status: OrderStatus.DELIVERED,
    });
    expect(await balanceOf(establishmentId)).toBe(0); // settled 5

    await service.adminIssueRefund(orderId.toString(), { reason: 'Wrong items' } as never, AUDIT);

    expect(await balanceOf(establishmentId)).toBe(5);
  });

  it('refuses a second refund of the same order, and moves nothing', async () => {
    const { orderId, establishmentId } = await completedSale({
      due: 0,
      subtotal: 10,
      method: 'cash_on_pickup',
      status: OrderStatus.PICKED_UP,
    });
    await service.adminIssueRefund(orderId.toString(), { reason: 'first' } as never, AUDIT);

    await expect(
      service.adminIssueRefund(orderId.toString(), { reason: 'again' } as never, AUDIT),
    ).rejects.toThrow();
    expect(await balanceOf(establishmentId)).toBe(0);
    expect(await ledgerModel.countDocuments({ orderId, type: CommissionLedgerType.REVERSAL })).toBe(
      1,
    );
  });

  it('refuses a cash order that was never completed - cancel it instead', async () => {
    const { orderId } = await completedSale({
      due: 0,
      subtotal: 10,
      method: 'cash_on_pickup',
      status: OrderStatus.RESERVED,
    });

    await expect(
      service.adminIssueRefund(orderId.toString(), { reason: 'x' } as never, AUDIT),
    ).rejects.toThrow(/completed/);
    expect((await orderModel.findById(orderId).lean())?.status).toBe(OrderStatus.RESERVED);
  });
});
