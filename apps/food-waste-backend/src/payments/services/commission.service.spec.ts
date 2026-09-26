/**
 * CommissionService - moving a merchant's outstanding commission balance.
 *
 * Two engines, chosen by COMMISSION_MODEL_EFFECTIVE_AT:
 * - **LEGACY** (before the cutoff, online HELD pickups only) - the original
 *   describes below, unchanged in what they assert about money.
 * - **V2** (at or after it) - `describe('the V2 model ...')` at the end. The
 *   pure rule is `orders/__tests__/commission-model.spec.ts`; this covers
 *   the persistence around it.
 *
 * The pure arithmetic is covered by `orders/__tests__/commission-settlement.spec.ts`.
 * This suite covers what that one cannot: persistence, idempotency, the refund
 * reversal, and the defensive branches around missing or legacy data.
 *
 * ## What these pin down
 *
 * - **Idempotency.** PM2 runs one worker per core and the pickup path retries,
 *   so the same order can arrive twice. The second arrival must be a no-op, not
 *   a second accrual.
 * - **Both ledger rows.** A settling order writes an ACCRUAL *and* a
 *   SETTLEMENT row. Collapsing them into one net row is what turns a 19% take
 *   rate into 16%, and it is the exact thing a merchant disputes.
 * - **Reversal moves both directions.** Undoing only the accrual leaves the
 *   merchant permanently short; undoing only the settlement gifts him
 *   commission.
 * - **Legacy documents.** An establishment stored before `commissionDue`
 *   existed hydrates it as `undefined`, and `undefined + n` is `NaN` - which
 *   would poison the balance permanently rather than loudly.
 */

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';

import { CommissionLedger, CommissionLedgerType } from '../schemas/commission-ledger.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';
import { Establishment } from '../../establishments/schemas/establishment.schema';
import { Order } from '../../orders/schemas/order.schema';
import { CommissionService } from './commission.service';

const ESTABLISHMENT_ID = new Types.ObjectId();
const MERCHANT_ID = new Types.ObjectId();
const ORDER_ID = new Types.ObjectId();

const NOW = new Date('2026-09-24T10:00:00.000Z');

/**
 * The LEGACY path: no cutoff configured (see `cutoff` below), an online
 * payment HELD at pickup - the only case the pre-cutoff engine ever ran for.
 */
const input = (subtotal: number) => ({
  establishmentId: ESTABLISHMENT_ID,
  merchantId: MERCHANT_ID,
  orderId: ORDER_ID,
  subtotal,
  controlledBy: 'TFTW' as const,
  appliedAt: NOW,
  legacyEligible: true,
});

/** `findById().select().session()` returns the stubbed document. */
const establishmentFinder = (doc: { commissionDue?: number } | null) => ({
  select: jest.fn().mockReturnValue({ session: jest.fn().mockResolvedValue(doc) }),
});

describe('CommissionService', () => {
  let service: CommissionService;
  let establishmentModel: {
    findById: jest.Mock;
    updateOne: jest.Mock;
  };
  let ledgerModel: {
    create: jest.Mock;
    exists: jest.Mock;
    find: jest.Mock;
  };
  let orderModel: { updateOne: jest.Mock };
  let platformTxModel: { create: jest.Mock; exists: jest.Mock; find: jest.Mock };
  /** COMMISSION_MODEL_EFFECTIVE_AT as the ConfigService returns it. */
  let cutoff: string | undefined;
  const session = {} as ClientSession;

  /** Controls what the idempotency probe sees. */
  const setAlreadyApplied = (applied: boolean) => {
    ledgerModel.exists.mockReturnValue({
      session: jest.fn().mockResolvedValue(applied ? { _id: new Types.ObjectId() } : null),
    });
  };

  /** Controls what `reverseForOrder` reads back from the ledger. */
  const setExistingRows = (rows: { type: CommissionLedgerType; amount: number }[]) => {
    ledgerModel.find.mockReturnValue({ session: jest.fn().mockResolvedValue(rows) });
  };

  /** Whether the order's payment booked NET_COMMISSION (paid before revenue moved). */
  const setBookedAtPayment = (booked: boolean) => {
    platformTxModel.exists.mockReturnValue({
      session: jest.fn().mockResolvedValue(booked ? { _id: new Types.ObjectId() } : null),
    });
  };

  /** Platform rows `reverseForOrder` reads back. */
  const setPlatformRows = (rows: Array<Record<string, unknown>>) => {
    platformTxModel.find.mockReturnValue({
      session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) }),
    });
  };

  /** Every platform row this test wrote, flattened across calls. */
  const platformRows = (): Array<Record<string, unknown>> =>
    platformTxModel.create.mock.calls.flatMap(([docs]) => docs as Array<Record<string, unknown>>);

  beforeEach(async () => {
    platformTxModel = {
      create: jest.fn().mockResolvedValue([]),
      exists: jest.fn(),
      find: jest.fn(),
    };
    setBookedAtPayment(false);
    setPlatformRows([]);
    establishmentModel = {
      findById: jest.fn().mockReturnValue(establishmentFinder({ commissionDue: 0 })),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    ledgerModel = {
      create: jest.fn().mockResolvedValue([]),
      exists: jest.fn(),
      find: jest.fn(),
    };
    orderModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    cutoff = undefined;
    setAlreadyApplied(false);
    setExistingRows([]);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(CommissionLedger.name), useValue: ledgerModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(PlatformTransaction.name), useValue: platformTxModel },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'COMMISSION_MODEL_EFFECTIVE_AT' ? cutoff : undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CommissionService);
  });

  describe('applyForOrder - the common case', () => {
    it('credits the merchant the full price and accrues the commission', async () => {
      const result = await service.applyForOrder(input(5), session);

      expect(result).toMatchObject({
        model: 'LEGACY',
        kind: 'NORMAL',
        accrued: 0.95,
        settled: 0,
        merchantAmount: 5,
        dueAfter: 0.95,
      });
      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: 0.95 } },
        { session },
      );
    });

    it('writes exactly one ACCRUAL row when nothing settles', async () => {
      await service.applyForOrder(input(5), session);

      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: CommissionLedgerType.ACCRUAL,
        amount: 0.95,
        balanceAfter: 0.95,
        merchantAmount: 5,
        orderSubtotal: 5,
      });
    });
  });

  describe('applyForOrder - a settling order', () => {
    beforeEach(() => {
      // 4.750 + 0.950 = 5.700, over the 5.000 threshold; cap takes 2.500.
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 4.75 }));
    });

    it('takes the whole order, crediting the merchant nothing for it', async () => {
      const result = await service.applyForOrder(input(5), session);

      expect(result).toMatchObject({ settled: 5, merchantAmount: 0, dueAfter: 0.7 });
    });

    it('writes BOTH an accrual and a settlement row', async () => {
      await service.applyForOrder(input(5), session);

      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        type: CommissionLedgerType.ACCRUAL,
        amount: 0.95,
        balanceAfter: 5.7,
      });
      expect(rows[1]).toMatchObject({
        type: CommissionLedgerType.SETTLEMENT,
        amount: 5,
        balanceAfter: 0.7,
      });
    });

    it('records the accrual balance before the settlement is taken', async () => {
      await service.applyForOrder(input(5), session);

      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      const accrual = rows[0] as { balanceAfter: number };
      const settlement = rows[1] as { balanceAfter: number; amount: number };

      // The snapshot chain must be continuous or the audit trail cannot be
      // replayed against the running balance.
      expect(accrual.balanceAfter - settlement.amount).toBeCloseTo(settlement.balanceAfter, 3);
    });
  });

  describe('idempotency', () => {
    it('returns null and touches nothing when the order was already applied', async () => {
      setAlreadyApplied(true);

      const result = await service.applyForOrder(input(5), session);

      expect(result).toBeNull();
      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
      expect(ledgerModel.create).not.toHaveBeenCalled();
    });
  });

  describe('defensive branches', () => {
    it('treats a legacy establishment with no commissionDue as zero, not NaN', async () => {
      establishmentModel.findById.mockReturnValue(establishmentFinder({}));

      const result = await service.applyForOrder(input(5), session);

      expect(result?.dueAfter).toBe(0.95);
      expect(Number.isNaN(result?.dueAfter)).toBe(false);
    });

    it('skips rather than aborting the pickup when the establishment is missing', async () => {
      // An order cannot reference a missing establishment, so this is an
      // integrity failure, not a user-reachable branch. Throwing here would
      // roll back the customer's pickup over a bookkeeping row.
      establishmentModel.findById.mockReturnValue(establishmentFinder(null));

      const result = await service.applyForOrder(input(5), session);

      expect(result).toBeNull();
      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
    });

    it('accrues nothing on a zero subtotal and leaves the balance untouched', async () => {
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 20 }));

      const result = await service.applyForOrder(input(0), session);

      expect(result).toMatchObject({ accrued: 0, settled: 0, dueAfter: 20 });
    });
  });

  describe('reverseForOrder', () => {
    it('is a no-op for an order that never reached pickup', async () => {
      setExistingRows([]);

      await service.reverseForOrder(input(5), 1, session);

      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
      expect(ledgerModel.create).not.toHaveBeenCalled();
    });

    it('removes the accrual when the refunded order never settled', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 0.95 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3 }));

      await service.reverseForOrder(input(5), 1, session);

      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: 2.05 } },
        { session },
      );
    });

    it('restores a settlement AND removes the accrual on a settled order', async () => {
      setExistingRows([
        { type: CommissionLedgerType.ACCRUAL, amount: 0.95 },
        { type: CommissionLedgerType.SETTLEMENT, amount: 2.5 },
      ]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3.2 }));

      await service.reverseForOrder(input(5), 1, session);

      // 3.200 + 2.500 settled back - 0.950 accrual removed = 4.750, which is
      // exactly the balance before the refunded order was applied.
      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: 4.75 } },
        { session },
      );
    });

    it('scales both directions on a partial refund', async () => {
      setExistingRows([
        { type: CommissionLedgerType.ACCRUAL, amount: 0.95 },
        { type: CommissionLedgerType.SETTLEMENT, amount: 2.5 },
      ]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3.2 }));

      await service.reverseForOrder(input(5), 0.5, session);

      // (2.500 - 0.950) * 0.5 = 0.775
      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: 3.975 } },
        { session },
      );
    });

    it('leaves a merchant credit when the refunded commission was already collected', async () => {
      /*
       * The balance was settled down after this order was applied, so removing
       * its accrual takes the balance below zero. That negative is a credit the
       * merchant holds, and it must survive: clamping it at zero kept 4 TND of
       * their money for a sale that no longer exists.
       *
       * The credit is consumed by later accruals, so it resolves itself as the
       * merchant keeps trading.
       */
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 5 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 1 }));

      await service.reverseForOrder(input(26.3), 1, session);

      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: -4 } },
        { session },
      );
    });

    it('records the reversal with a signed delta so the ledger stays replayable', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 0.95 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3 }));

      await service.reverseForOrder(input(5), 1, session);

      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];

      // `amount` is absolute for display; `balanceDelta` carries the direction.
      // Reconciliation reads the signed value - summing `amount` per type omits
      // reversals entirely and breaks the platform identity after every refund.
      expect(rows[0]).toMatchObject({ amount: 0.95, balanceDelta: -0.95 });
    });

    it('writes a REVERSAL row carrying the reason', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 0.95 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3 }));

      await service.reverseForOrder(input(5), 1, session);

      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      expect(rows[0]).toMatchObject({
        type: CommissionLedgerType.REVERSAL,
        amount: 0.95,
        balanceAfter: 2.05,
        reason: 'Order refunded',
      });
    });

    it.each([0, -1])('ignores a refund ratio of %p', async ratio => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 0.95 }]);

      await service.reverseForOrder(input(5), ratio, session);

      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
    });

    it('clamps a ratio above 1 to a full reversal', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 0.95 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 3 }));

      await service.reverseForOrder(input(5), 4, session);

      expect(establishmentModel.updateOne).toHaveBeenCalledWith(
        { _id: ESTABLISHMENT_ID },
        { $set: { commissionDue: 2.05 } },
        { session },
      );
    });
  });

  describe('the V2 model (at or after COMMISSION_MODEL_EFFECTIVE_AT)', () => {
    const CUTOFF = '2026-09-24T00:00:00+01:00';
    const v2 = (
      subtotal: number,
      over: Partial<{
        controlledBy: 'TFTW' | 'MERCHANT' | undefined;
        legacyEligible: boolean;
      }> = {},
    ) => ({
      ...input(subtotal),
      legacyEligible: false,
      controlledBy: 'MERCHANT' as 'TFTW' | 'MERCHANT' | undefined,
      ...over,
    });

    beforeEach(() => {
      cutoff = CUTOFF;
    });

    it('accrues 19% on a cash pickup, which the legacy engine never touched', async () => {
      const result = await service.applyForOrder(v2(10), session);

      expect(result).toMatchObject({
        model: 'V2',
        kind: 'NORMAL',
        controlledBy: 'MERCHANT',
        accrued: 1.9,
        settled: 0,
        merchantAmount: 10,
        dueBefore: 0,
        dueAfter: 1.9,
      });
      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: CommissionLedgerType.ACCRUAL, amount: 1.9 });
    });

    it('never settles merchant-collected cash, however large the balance', async () => {
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 20 }));

      const result = await service.applyForOrder(v2(10), session);

      expect(result).toMatchObject({ kind: 'NORMAL', settled: 0, dueAfter: 21.9 });
    });

    it('writes ONLY a SETTLEMENT row on a settlement - no new 19%', async () => {
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 5 }));

      const result = await service.applyForOrder(v2(10, { controlledBy: 'TFTW' }), session);

      expect(result).toMatchObject({
        kind: 'SETTLEMENT',
        accrued: 0,
        settled: 5,
        merchantAmount: 5,
        dueAfter: 0,
      });
      const [rows] = ledgerModel.create.mock.calls[0] as [Record<string, unknown>[]];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: CommissionLedgerType.SETTLEMENT,
        amount: 5,
        balanceDelta: -5,
        balanceAfter: 0,
      });
    });

    it('freezes the decision onto the order, only if none is there yet', async () => {
      await service.applyForOrder(v2(10), session);

      expect(orderModel.updateOne).toHaveBeenCalledWith(
        { _id: ORDER_ID, commission: { $exists: false } },
        {
          $set: expect.objectContaining({
            commission: expect.objectContaining({ model: 'V2', kind: 'NORMAL', appliedAt: NOW }),
            'pricing.merchantAmount': 10,
            'pricing.commissionSettled': 0,
          }),
        },
        { session },
      );
    });

    it('applies nothing to a cash order completed before the cutoff', async () => {
      cutoff = '2026-09-25T00:00:00+01:00'; // NOW is before it

      const result = await service.applyForOrder(v2(10), session);

      expect(result).toBeNull();
      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
      expect(ledgerModel.create).not.toHaveBeenCalled();
      expect(orderModel.updateOne).not.toHaveBeenCalled();
    });

    it('applies at exactly the cutoff instant', async () => {
      cutoff = NOW.toISOString();

      const result = await service.applyForOrder(v2(10), session);

      expect(result?.model).toBe('V2');
    });

    it('refuses to guess for a post-cutoff order with no paymentControl', async () => {
      const result = await service.applyForOrder(v2(10, { controlledBy: undefined }), session);

      expect(result).toBeNull();
      expect(ledgerModel.create).not.toHaveBeenCalled();
    });

    it('treats an existing SETTLEMENT row as applied, not only an ACCRUAL', async () => {
      await service.applyForOrder(v2(10), session);

      expect(ledgerModel.exists).toHaveBeenCalledWith({
        orderId: ORDER_ID,
        type: { $in: [CommissionLedgerType.ACCRUAL, CommissionLedgerType.SETTLEMENT] },
      });
    });
  });

  describe("TFTW's platform ledger", () => {
    const CUTOFF = '2026-09-24T00:00:00+01:00';
    const v2 = (subtotal: number, controlledBy: 'TFTW' | 'MERCHANT') => ({
      ...input(subtotal),
      legacyEligible: false,
      controlledBy,
    });

    beforeEach(() => {
      cutoff = CUTOFF;
    });

    it('books the commission a NORMAL sale earns, for cash as much as online', async () => {
      await service.applyForOrder(v2(10, 'MERCHANT'), session);

      expect(platformRows()).toEqual([
        expect.objectContaining({
          type: 'COMMISSION_EARNED',
          amount: 1.9,
          reference: `COMMISSION-EARNED-${ORDER_ID.toString()}`,
        }),
      ]);
    });

    it('books no revenue on a SETTLEMENT sale, only the commission it collected', async () => {
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 5 }));

      await service.applyForOrder(v2(10, 'TFTW'), session);

      const rows = platformRows();
      expect(rows.map(r => r['type'])).toEqual(['COMMISSION_SETTLED']);
      expect(rows[0]).toMatchObject({ amount: 5 });
    });

    it('passes ordered:true whenever it writes several rows in the transaction', async () => {
      // LEGACY on a settling order writes both an accrual and a settlement.
      cutoff = undefined;
      establishmentModel.findById.mockReturnValue(establishmentFinder({ commissionDue: 5 }));

      await service.applyForOrder(input(10), session);

      const [docs, options] = platformTxModel.create.mock.calls[0] as [unknown[], unknown];
      expect(docs).toHaveLength(2);
      expect(options).toEqual({ session, ordered: true });
    });

    it('does not book again an order whose payment already booked its revenue', async () => {
      setBookedAtPayment(true);

      await service.applyForOrder(v2(10, 'MERCHANT'), session);

      expect(platformTxModel.create).not.toHaveBeenCalled();
    });

    it('books nothing for an order the model does not apply to', async () => {
      cutoff = undefined; // pre-cutoff cash sale: neither engine runs

      await service.applyForOrder({ ...v2(10, 'MERCHANT'), legacyEligible: false }, session);

      expect(platformTxModel.create).not.toHaveBeenCalled();
    });

    it('reverses exactly the rows it booked, scaled by the refund ratio', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 1.9 }]);
      setPlatformRows([
        {
          type: 'COMMISSION_EARNED',
          amount: 1.9,
          currency: 'TND',
          reference: `COMMISSION-EARNED-${ORDER_ID.toString()}`,
        },
      ]);

      await service.reverseForOrder(input(10), 0.5, session);

      expect(platformRows()).toEqual([
        expect.objectContaining({
          type: 'COMMISSION_EARNED',
          amount: -0.95,
          reference: `REVERSAL-COMMISSION-EARNED-${ORDER_ID.toString()}`,
        }),
      ]);
    });

    // The establishment document can be gone (deleted merchant) while the
    // platform ledger still holds the sale. Returning early left TFTW's
    // revenue booked for a refunded order.
    it('still reverses platform revenue when the establishment no longer exists', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 1.9 }]);
      establishmentModel.findById.mockReturnValue(establishmentFinder(null));
      setPlatformRows([
        {
          type: 'COMMISSION_EARNED',
          amount: 1.9,
          currency: 'TND',
          reference: `COMMISSION-EARNED-${ORDER_ID.toString()}`,
        },
      ]);

      await service.reverseForOrder(input(10), 1, session);

      expect(platformRows()).toEqual([
        expect.objectContaining({ type: 'COMMISSION_EARNED', amount: -1.9 }),
      ]);
      // No balance to move and no merchant REVERSAL row without one.
      expect(establishmentModel.updateOne).not.toHaveBeenCalled();
      expect(ledgerModel.create).not.toHaveBeenCalled();
    });

    it('reverses no platform revenue when nothing was booked', async () => {
      setExistingRows([{ type: CommissionLedgerType.ACCRUAL, amount: 1.9 }]);
      setPlatformRows([]);

      await service.reverseForOrder(input(10), 1, session);

      expect(platformTxModel.create).not.toHaveBeenCalled();
    });
  });
});
