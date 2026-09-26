import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { parseCommissionCutoff } from '../../config/commission-cutoff.util';
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import {
  decideCommission,
  type CommissionKind,
  type ControlledBy,
} from '../../orders/utils/commission-model.util';
import { calculateCommissionSettlement } from '../../orders/utils/order-pricing.util';
import {
  PlatformTransaction,
  PlatformTransactionDocument,
} from '../schemas/platform-transaction.schema';
import {
  CommissionLedger,
  CommissionLedgerDocument,
  CommissionLedgerType,
} from '../schemas/commission-ledger.schema';

/** Identifies an order's commission rows. Enough to reverse them. */
export interface CommissionOrderRef {
  establishmentId: Types.ObjectId;
  merchantId: Types.ObjectId;
  orderId: Types.ObjectId;
  /** Food subtotal. Never `pricing.total`. */
  subtotal: number;
}

export interface ApplyCommissionInput extends CommissionOrderRef {
  /**
   * `order.paymentControl.controlledBy`, stored at creation. `undefined` only
   * for an order that predates the field and missed the backfill - the new
   * model refuses to guess for it.
   */
  controlledBy: ControlledBy | undefined;
  /**
   * The instant the order completed (pickup) or the driver collected it from
   * the merchant (delivery). Tested against COMMISSION_MODEL_EFFECTIVE_AT and
   * stored as `order.commission.appliedAt`.
   */
  appliedAt: Date;
  /**
   * Whether the pre-cutoff engine would have run for this order: an online
   * payment HELD at pickup confirmation. Before the cutoff nothing else ever
   * accrued, and nothing else must start to.
   */
  legacyEligible: boolean;
}

/** What an application decided - the same shape for both engines. */
export interface CommissionOutcome {
  model: 'LEGACY' | 'V2';
  kind: CommissionKind;
  controlledBy?: ControlledBy;
  accrued: number;
  settled: number;
  merchantAmount: number;
  dueBefore: number;
  dueAfter: number;
}

/**
 * Moves a merchant's outstanding commission balance and records why.
 *
 * ## The model
 *
 * The merchant is credited the **full** order price on almost every order. The
 * platform's 19% accrues into `Establishment.commissionDue` and is collected in
 * occasional lumps from later orders, capped so the merchant is never credited
 * zero. Take rate is unchanged at 19%; only the shape of collection is.
 *
 * ## Concurrency
 *
 * The balance cannot be a bare `$inc`, because the settlement depends on its
 * current value. Every mutation therefore runs **inside the caller's
 * transaction**, where MongoDB's snapshot isolation turns a concurrent write
 * into a conflict the transaction retries. A `session` is mandatory rather than
 * optional for exactly that reason.
 *
 * ## Idempotency
 *
 * PM2 runs one worker per core and the pickup path can be retried, so the same
 * order may arrive twice. The unique `(orderId, type)` index on the ledger is
 * the guard: a duplicate key is the losing worker's normal path, and
 * {@link applyForOrder} returns `null` for it rather than throwing.
 */
@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly ledgerModel: Model<CommissionLedgerDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PlatformTransaction.name)
    private readonly platformTxModel: Model<PlatformTransactionDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The configured cutoff, or `null` when unset (allowed outside production,
   * where it leaves the new model inactive). Read per call so a restart with a
   * new value never leaves a stale instant cached.
   */
  private cutoff(): Date | null {
    return parseCommissionCutoff(this.configService.get<string>('COMMISSION_MODEL_EFFECTIVE_AT'));
  }

  /** Whether the new model governs an order applied at this instant. */
  isModelActiveAt(appliedAt: Date): boolean {
    const cutoff = this.cutoff();
    return cutoff !== null && appliedAt.getTime() >= cutoff.getTime();
  }

  /** TND is quoted to three decimals. Matches `round()` in `order-pricing.util.ts`. */
  private round(value: number): number {
    return parseFloat(value.toFixed(3));
  }

  /**
   * Decides this order's commission once, moves the balance, writes the
   * ledger row and freezes the decision onto the order - all in the caller's
   * transaction.
   *
   * - At or after COMMISSION_MODEL_EFFECTIVE_AT: the new model
   *   (`decideCommission`) for every completed sale, cash or online.
   * - Before it: the pre-cutoff engine, and only where it always ran (an
   *   online payment HELD at pickup). Historical behaviour is kept exactly.
   *
   * @returns the outcome, or `null` when nothing applies or this order was
   *          already applied (the losing worker of a duplicate confirmation).
   */
  async applyForOrder(
    input: ApplyCommissionInput,
    session: ClientSession,
  ): Promise<CommissionOutcome | null> {
    if (await this.alreadyApplied(input.orderId, session)) {
      this.logger.debug(`Commission already applied for order ${input.orderId.toString()}`);
      return null;
    }

    const active = this.isModelActiveAt(input.appliedAt);
    if (!active && !input.legacyEligible) {
      return null;
    }
    if (active && input.controlledBy === undefined) {
      /*
       * Never guessed: the model forbids inferring control from the payment
       * method. The audit script reports post-cutoff orders missing
       * `order.commission`, which is where this surfaces.
       */
      this.logger.error(
        `Order ${input.orderId.toString()} has no paymentControl; commission not applied`,
      );
      return null;
    }

    const establishment = await this.establishmentModel
      .findById(input.establishmentId)
      .select('commissionDue')
      .session(session);

    if (!establishment) {
      /*
       * An order cannot reference a missing establishment, so this is an
       * integrity failure rather than a user-reachable branch. Skipping is
       * safer than throwing: it would otherwise abort the whole pickup
       * transaction and block the customer over a bookkeeping row.
       */
      this.logger.error(
        `Establishment ${input.establishmentId.toString()} not found; commission not applied for order ${input.orderId.toString()}`,
      );
      return null;
    }

    /*
     * `?? 0` covers establishments stored before `commissionDue` existed. The
     * schema default handles documents Mongoose hydrates, but an aggregation or
     * a lean read elsewhere could still surface undefined, and `undefined + n`
     * is NaN - which would poison the balance permanently.
     */
    const currentDue = establishment.commissionDue ?? 0;

    const outcome: CommissionOutcome = active
      ? this.decideV2(input, currentDue)
      : this.decideLegacy(input, currentDue);

    await this.establishmentModel.updateOne(
      { _id: input.establishmentId },
      { $set: { commissionDue: outcome.dueAfter } },
      { session },
    );

    await this.writeLedgerRows(input, outcome, session);
    await this.freezeOntoOrder(input, outcome, session);
    await this.bookPlatformRevenue(input, outcome, session);

    return outcome;
  }

  private decideV2(input: ApplyCommissionInput, currentDue: number): CommissionOutcome {
    const decision = decideCommission({
      subtotal: input.subtotal,
      commissionDue: currentDue,
      // Checked by applyForOrder before this is reached.
      controlledBy: input.controlledBy as ControlledBy,
    });
    return { model: 'V2', ...decision };
  }

  /** The pre-cutoff engine: accrues AND may settle on the same order. */
  private decideLegacy(input: ApplyCommissionInput, currentDue: number): CommissionOutcome {
    const legacy = calculateCommissionSettlement(input.subtotal, currentDue);
    return {
      model: 'LEGACY',
      kind: legacy.settled > 0 ? 'SETTLEMENT' : 'NORMAL',
      ...(input.controlledBy ? { controlledBy: input.controlledBy } : {}),
      accrued: legacy.accrued,
      settled: legacy.settled,
      merchantAmount: legacy.merchantAmount,
      dueBefore: this.round(currentDue),
      dueAfter: legacy.commissionDueAfter,
    };
  }

  /**
   * `order.commission` plus the two denormalised pricing fields every
   * earnings aggregation reads (MERCHANT_EARNINGS_EXPR). Conditional on no
   * decision being there yet, so it can never overwrite a frozen one.
   */
  private async freezeOntoOrder(
    input: ApplyCommissionInput,
    outcome: CommissionOutcome,
    session: ClientSession,
  ): Promise<void> {
    await this.orderModel.updateOne(
      { _id: input.orderId, commission: { $exists: false } },
      {
        $set: {
          commission: { ...outcome, appliedAt: input.appliedAt },
          'pricing.merchantAmount': outcome.merchantAmount,
          'pricing.commissionSettled': outcome.settled,
        },
      },
      { session },
    );
  }

  /**
   * Reverses a refunded order: the accrual is undone, and any settlement taken
   * from it is restored to the balance.
   *
   * Both directions matter. Undoing only the accrual would leave the merchant
   * permanently short by whatever was settled from an order that no longer
   * exists; undoing only the settlement would hand him free commission.
   *
   * @param refundRatio 1 for a full refund, `refunded / subtotal` for a partial.
   */
  async reverseForOrder(
    input: CommissionOrderRef,
    refundRatio: number,
    session: ClientSession,
  ): Promise<void> {
    const ratio = Math.min(Math.max(refundRatio, 0), 1);
    if (ratio === 0) {
      return;
    }

    const rows = await this.ledgerModel
      .find({
        orderId: input.orderId,
        type: { $in: [CommissionLedgerType.ACCRUAL, CommissionLedgerType.SETTLEMENT] },
      })
      .session(session);

    if (rows.length === 0) {
      return;
    }

    const accrued = rows
      .filter(row => row.type === CommissionLedgerType.ACCRUAL)
      .reduce((sum, row) => sum + row.amount, 0);
    const settled = rows
      .filter(row => row.type === CommissionLedgerType.SETTLEMENT)
      .reduce((sum, row) => sum + row.amount, 0);

    /*
     * Accrual leaves the balance, settlement returns to it. On a full refund of
     * an order that settled, the two partly cancel - which is correct: the
     * merchant keeps neither the commission nor the debt from a sale that was
     * undone.
     */
    const delta = this.round((settled - accrued) * ratio);

    const establishment = await this.establishmentModel
      .findById(input.establishmentId)
      .select('commissionDue')
      .session(session);

    if (!establishment) {
      // No merchant balance to adjust - but TFTW's own revenue for the sale
      // still has to come off. Returning before this left COMMISSION_EARNED /
      // SETTLED booked for a refunded order.
      this.logger.warn('Refund reversal: establishment not found; platform revenue reversed only', {
        orderId: input.orderId.toString(),
        establishmentId: input.establishmentId.toString(),
      });
      await this.reversePlatformRevenue(input.orderId, ratio, session);
      return;
    }

    /*
     * Deliberately NOT clamped at zero.
     *
     * A negative balance is a credit the merchant holds, and it is the only
     * correct outcome when a refunded order's commission was already collected
     * by an earlier settlement. Clamping discarded that credit and left the
     * merchant permanently overcharged for a sale that no longer exists -
     * silently, because the running balance still looked plausible at 0.
     *
     * The credit is consumed by the next accruals: `calculateCommissionSettlement`
     * adds to a negative balance, which stays under SETTLEMENT_THRESHOLD, so the
     * merchant is simply paid in full until the credit is used up.
     *
     * Found by the seeded chaos scenarios in `commission-scenarios.spec.ts`,
     * which assert `accrued - settled === balance` after every single event.
     */
    const balanceAfter = this.round((establishment.commissionDue ?? 0) + delta);

    await this.establishmentModel.updateOne(
      { _id: input.establishmentId },
      { $set: { commissionDue: balanceAfter } },
      { session },
    );

    await this.reversePlatformRevenue(input.orderId, ratio, session);

    await this.ledgerModel.create(
      [
        {
          establishmentId: input.establishmentId,
          merchantId: input.merchantId,
          orderId: input.orderId,
          type: CommissionLedgerType.REVERSAL,
          amount: Math.abs(delta),
          // Signed, unlike : a reversal moves the balance either way.
          balanceDelta: delta,
          balanceAfter,
          orderSubtotal: input.subtotal,
          reason: ratio === 1 ? 'Order refunded' : `Order partially refunded (${ratio})`,
        },
      ],
      { session },
    );
  }

  /**
   * TFTW's side of the same decision, in the same transaction: what the sale
   * earned and what it collected. Revenue is recognised when it is earned - at
   * the commission moment, for every payment method: pickup confirmation, or
   * for a delivery the driver collecting the food from the merchant (see
   * .claude/work/commission-settlement-model.md) - not at online payment time,
   * which is what the platform ledger used to do (online only, a flat 19%).
   *
   * - COMMISSION_EARNED = `outcome.accrued`: 19% of a NORMAL sale, 0 on a V2
   *   SETTLEMENT sale (it earns nothing new; see the model).
   * - COMMISSION_SETTLED = `outcome.settled`: commission collected back. Cash
   *   received, not revenue, so it is its own type and never summed as income.
   *
   * The charity pledge is not booked here: DonationsService writes it with the
   * pool contribution, so the pool and the ledger cannot disagree.
   *
   * An order paid online before this change was booked at payment time
   * (NET_COMMISSION). Booking it again at completion would count its revenue
   * twice, so such an order is skipped.
   */
  private async bookPlatformRevenue(
    input: ApplyCommissionInput,
    outcome: CommissionOutcome,
    session: ClientSession,
  ): Promise<void> {
    const bookedAtPayment = await this.platformTxModel
      .exists({ orderId: input.orderId, type: 'NET_COMMISSION', amount: { $gt: 0 } })
      .session(session);
    if (bookedAtPayment) {
      return;
    }

    const id = input.orderId.toString();
    const rows: Partial<PlatformTransaction>[] = [];
    if (outcome.accrued > 0) {
      rows.push({
        orderId: input.orderId,
        type: 'COMMISSION_EARNED',
        amount: this.round(outcome.accrued),
        currency: 'TND',
        reference: `COMMISSION-EARNED-${id}`,
        notes: `${outcome.model} ${outcome.kind} on subtotal ${input.subtotal}`,
      });
    }
    if (outcome.settled > 0) {
      rows.push({
        orderId: input.orderId,
        type: 'COMMISSION_SETTLED',
        amount: this.round(outcome.settled),
        currency: 'TND',
        reference: `COMMISSION-SETTLED-${id}`,
        notes: 'Commission collected by a settlement sale',
      });
    }
    if (rows.length > 0) {
      await this.platformTxModel.create(rows, { session, ordered: true });
    }
  }

  /**
   * Negates exactly what `bookPlatformRevenue` wrote, scaled by the refund
   * ratio. Nothing booked, nothing reversed - never a recomputed 19%.
   */
  private async reversePlatformRevenue(
    orderId: Types.ObjectId,
    ratio: number,
    session: ClientSession,
  ): Promise<void> {
    const booked = await this.platformTxModel
      .find({
        orderId,
        type: { $in: ['COMMISSION_EARNED', 'COMMISSION_SETTLED'] },
        amount: { $gt: 0 },
      })
      .session(session)
      .lean();
    if (booked.length === 0) {
      return;
    }

    await this.platformTxModel.create(
      booked.map(row => ({
        orderId,
        type: row.type,
        amount: -this.round(row.amount * ratio),
        currency: row.currency,
        reference: `REVERSAL-${row.reference}`,
        notes: ratio === 1 ? 'Order refunded' : `Order partially refunded (${ratio})`,
      })),
      { session, ordered: true },
    );
  }

  /**
   * Either row type marks the order as applied. A V2 SETTLEMENT writes no
   * ACCRUAL, so probing ACCRUAL alone would let a retry apply it twice.
   */
  private async alreadyApplied(orderId: Types.ObjectId, session: ClientSession): Promise<boolean> {
    const existing = await this.ledgerModel
      .exists({
        orderId,
        type: { $in: [CommissionLedgerType.ACCRUAL, CommissionLedgerType.SETTLEMENT] },
      })
      .session(session);

    return existing !== null;
  }

  private async writeLedgerRows(
    input: ApplyCommissionInput,
    outcome: CommissionOutcome,
    session: ClientSession,
  ): Promise<void> {
    const base = {
      establishmentId: input.establishmentId,
      merchantId: input.merchantId,
      orderId: input.orderId,
      orderSubtotal: input.subtotal,
      merchantAmount: outcome.merchantAmount,
    };

    const rows: Record<string, unknown>[] = [];

    /*
     * V2 writes exactly one row: ACCRUAL for a NORMAL sale, SETTLEMENT for a
     * settlement. LEGACY writes the accrual even when the settlement takes it
     * straight back out, as the pre-cutoff engine always did - collapsing them
     * would erase the evidence that the sale carried commission.
     */
    if (outcome.model === 'LEGACY' || outcome.kind === 'NORMAL') {
      rows.push({
        ...base,
        type: CommissionLedgerType.ACCRUAL,
        amount: outcome.accrued,
        balanceDelta: outcome.accrued,
        balanceAfter: this.round(outcome.dueBefore + outcome.accrued),
      });
    }

    if (outcome.settled > 0) {
      rows.push({
        ...base,
        type: CommissionLedgerType.SETTLEMENT,
        amount: outcome.settled,
        balanceDelta: -outcome.settled,
        balanceAfter: outcome.dueAfter,
      });
    }

    await this.ledgerModel.create(rows, { session, ordered: true });
  }
}
