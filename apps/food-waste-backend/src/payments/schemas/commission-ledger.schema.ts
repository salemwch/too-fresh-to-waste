import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommissionLedgerDocument = CommissionLedger & Document;

/**
 * What moved the establishment's `commissionDue` balance.
 *
 * `ACCRUAL` and `SETTLEMENT` both happen on a completed order, and both may
 * happen on the *same* order - the accrual is unconditional, so an order that
 * settles still owes commission on its own sale. That is why idempotency is
 * keyed on `(orderId, type)` and not on `orderId` alone.
 */
export enum CommissionLedgerType {
  /** +balance. `subtotal * PLATFORM_FOOD_SHARE`. Every completed order. */
  ACCRUAL = 'accrual',
  /** −balance. Collected from an order's proceeds. */
  SETTLEMENT = 'settlement',
  /** Reverses an accrual or settlement when an order is refunded. */
  REVERSAL = 'reversal',
  /** Manual admin correction or write-off. Requires `actorId` and `reason`. */
  ADJUSTMENT = 'adjustment',
}

/**
 * Append-only history of every movement in a merchant's commission balance.
 *
 * `Establishment.commissionDue` is the running total; this collection is the
 * proof of how it got there. Nothing here is ever updated or deleted - a
 * correction is a new `ADJUSTMENT` or `REVERSAL` row.
 *
 * ## Why a separate collection
 *
 * The alternative was an embedded array on `Establishment`. A busy merchant
 * produces two rows per order, so the array would grow without bound and
 * eventually hit the 16 MB document limit - exactly the case CLAUDE.md's
 * "Embedded arrays - cap or move them" rule says to move out.
 *
 * ## Why `balanceAfter` is stored
 *
 * It is derivable by replaying every prior row, which makes it redundant right
 * up until the moment the balance and the ledger disagree. Storing the snapshot
 * turns "the numbers are wrong somewhere" into "they diverge at this row".
 */
@Schema({ timestamps: true, collection: 'commission_ledger' })
export class CommissionLedger {
  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  merchantId!: Types.ObjectId;

  /** Absent only on an admin `ADJUSTMENT`, which has no originating order. */
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: String, enum: CommissionLedgerType, required: true })
  type!: CommissionLedgerType;

  /**
   * Always positive. The direction is carried by {@link type}, not by the sign,
   * so an aggregation can `$sum` per type without a `$cond`.
   */
  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  /** `Establishment.commissionDue` immediately after this row was applied. */
  @Prop({ type: Number, required: true, min: 0 })
  balanceAfter!: number;

  /** Food subtotal of the originating order. Absent on `ADJUSTMENT`. */
  @Prop({ type: Number, min: 0 })
  orderSubtotal?: number;

  /** What the merchant was credited for the order: `subtotal - settled`. */
  @Prop({ type: Number, min: 0 })
  merchantAmount?: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  /** Admin who created an `ADJUSTMENT`. Never set on automated rows. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  /** Mandatory on `ADJUSTMENT`, enforced in the service, not the schema. */
  @Prop({ type: String })
  reason?: string;
}

export const CommissionLedgerSchema = SchemaFactory.createForClass(CommissionLedger);

// =============================================================================
// INDEXES
// =============================================================================

/**
 * Idempotency guard. PM2 runs one worker per core and the pickup-confirmation
 * path can be retried, so the same order may be processed twice concurrently.
 * A duplicate key here is the losing worker's normal path, not an error - see
 * the `uniq_single_active_pool` precedent in CLAUDE.md.
 *
 * Keyed on `(orderId, type)` rather than `orderId`: one order legitimately
 * produces both an ACCRUAL and a SETTLEMENT row.
 *
 * `partialFilterExpression` scopes it to rows that have an order, so admin
 * ADJUSTMENT rows (no `orderId`) are not forced into a single null slot.
 * Deliberately not `sparse` - CLAUDE.md forbids mixing the two.
 */
CommissionLedgerSchema.index(
  { orderId: 1, type: 1 },
  {
    unique: true,
    name: 'uniq_commission_ledger_order_type',
    partialFilterExpression: { orderId: { $exists: true } },
  },
);

/** Merchant statement and admin drill-down: newest movements first. */
CommissionLedgerSchema.index(
  { establishmentId: 1, createdAt: -1 },
  { name: 'idx_commission_ledger_establishment_recent' },
);

/** Admin period reporting: accrued vs collected across all merchants. */
CommissionLedgerSchema.index(
  { type: 1, createdAt: -1 },
  { name: 'idx_commission_ledger_type_recent' },
);
