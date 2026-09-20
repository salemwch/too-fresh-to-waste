import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import {
  CommissionSettlement,
  calculateCommissionSettlement,
} from '../../orders/utils/order-pricing.util';
import {
  CommissionLedger,
  CommissionLedgerDocument,
  CommissionLedgerType,
} from '../schemas/commission-ledger.schema';

export interface ApplyCommissionInput {
  establishmentId: Types.ObjectId;
  merchantId: Types.ObjectId;
  orderId: Types.ObjectId;
  /** Food subtotal. Never `pricing.total`. */
  subtotal: number;
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
  ) {}

  /** TND is quoted to three decimals. Matches `round()` in `order-pricing.util.ts`. */
  private round(value: number): number {
    return parseFloat(value.toFixed(3));
  }

  /**
   * Accrues this order's commission and settles what the cap allows.
   *
   * @returns the settlement, or `null` when this order was already applied.
   */
  async applyForOrder(
    input: ApplyCommissionInput,
    session: ClientSession,
  ): Promise<CommissionSettlement | null> {
    if (await this.alreadyApplied(input.orderId, session)) {
      this.logger.debug(`Commission already applied for order ${input.orderId.toString()}`);
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
    const settlement = calculateCommissionSettlement(input.subtotal, currentDue);

    await this.establishmentModel.updateOne(
      { _id: input.establishmentId },
      { $set: { commissionDue: settlement.commissionDueAfter } },
      { session },
    );

    await this.writeLedgerRows(input, settlement, session);

    return settlement;
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
    input: ApplyCommissionInput,
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

  private async alreadyApplied(orderId: Types.ObjectId, session: ClientSession): Promise<boolean> {
    const existing = await this.ledgerModel
      .exists({ orderId, type: CommissionLedgerType.ACCRUAL })
      .session(session);

    return existing !== null;
  }

  private async writeLedgerRows(
    input: ApplyCommissionInput,
    settlement: CommissionSettlement,
    session: ClientSession,
  ): Promise<void> {
    const base = {
      establishmentId: input.establishmentId,
      merchantId: input.merchantId,
      orderId: input.orderId,
      orderSubtotal: input.subtotal,
      merchantAmount: settlement.merchantAmount,
    };

    /*
     * The accrual row is written even when the settlement takes it straight
     * back out. Collapsing the two into one net row would erase the evidence
     * that this sale carried commission - which is the exact thing that makes
     * the difference between a 19% and a 16% take rate, and the exact thing a
     * merchant will dispute.
     */
    const rows: Record<string, unknown>[] = [
      {
        ...base,
        type: CommissionLedgerType.ACCRUAL,
        amount: settlement.accrued,
        balanceDelta: settlement.accrued,
        balanceAfter: this.round(settlement.commissionDueAfter + settlement.settled),
      },
    ];

    if (settlement.settled > 0) {
      rows.push({
        ...base,
        type: CommissionLedgerType.SETTLEMENT,
        amount: settlement.settled,
        balanceDelta: -settlement.settled,
        balanceAfter: settlement.commissionDueAfter,
      });
    }

    await this.ledgerModel.create(rows, { session, ordered: true });
  }
}
