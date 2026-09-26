import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import type { DriverCashStatus } from '../utils/driver-cash.util';

/**
 * One delivery's cash, from the driver paying the merchant out of the TFTW
 * float to the moment a handover reconciles it. Rules and figures:
 * `drivers/utils/driver-cash.util.ts`; model:
 * `.claude/work/commission-settlement-model.md` ("Driver cash").
 *
 * Money figures are written once when known and only moved forward by guarded
 * state transitions (`status` in the filter of every update). Handovers never
 * edit an amount here beyond `handedOverCash` / `outstandingCash`, and every
 * handover is itself an append-only `DriverCashHandover` row naming the
 * allocation, so the full history is reconstructible.
 */
@Schema({ timestamps: true, collection: 'driver_delivery_cash' })
export class DriverDeliveryCash {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  driverId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId!: Types.ObjectId;

  @Prop({ type: String, enum: ['pay_on_delivery', 'online'], required: true })
  paymentMethod!: 'pay_on_delivery' | 'online';

  @Prop({ type: String, enum: ['NORMAL', 'SETTLEMENT'], required: true })
  kind!: 'NORMAL' | 'SETTLEMENT';

  /** Paid by the driver to the merchant from the float, at pickup. */
  @Prop({ type: Number, required: true, min: 0 })
  paidToMerchant!: number;

  /** What the customer owes the driver at the door. 0 when paid online. */
  @Prop({ type: Number, required: true, min: 0 })
  expectedCash!: number;

  /** Confirmed by the driver at delivery. `null` until then. */
  @Prop({ type: Number, min: 0, default: null })
  collectedCash!: number | null;

  /**
   * False when the delivery was confirmed by an app that did not send the
   * amount, and `collectedCash` was taken as `expectedCash`. Always flagged in
   * reconciliation - an assumed collection is not a confirmed one.
   */
  @Prop({ type: Boolean, default: true })
  collectionConfirmedByDriver!: boolean;

  /** Handed back by the merchant when food is returned (failed delivery). */
  @Prop({ type: Number, default: 0, min: 0 })
  merchantReturnedCash!: number;

  /** The driver's share of the delivery fee, kept from the cash. */
  @Prop({ type: Number, required: true, min: 0 })
  driverKeeps!: number;

  /** TFTW's share of the delivery fee. */
  @Prop({ type: Number, required: true, min: 0 })
  tftwDeliveryRevenue!: number;

  /** Commission recovered by this order (SETTLEMENT), 0 on NORMAL. */
  @Prop({ type: Number, required: true, min: 0 })
  tftwSettlement!: number;

  /** Signed: > 0 the driver owes TFTW, < 0 TFTW owes the driver. */
  @Prop({ type: Number, default: null })
  dueToTftw!: number | null;

  @Prop({ type: Number, default: 0 })
  handedOverCash!: number;

  /** `dueToTftw - handedOverCash`, same sign convention. */
  @Prop({ type: Number, default: null })
  outstandingCash!: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  shortfall!: number;

  /** Food TFTW paid for and could not sell (pay-on-delivery, unrecoverable). */
  @Prop({ type: Number, default: 0, min: 0 })
  lossAmount!: number;

  @Prop({
    type: String,
    enum: ['EXPECTED', 'COLLECTED', 'SHORT', 'PARTIALLY_HANDED_OVER', 'HANDED_OVER', 'FAILED'],
    required: true,
  })
  status!: DriverCashStatus;

  /**
   * What happened to the food on a FAILED delivery. RECOVERABLE_PENDING until
   * an admin decides; unset on every other record.
   */
  @Prop({
    type: String,
    enum: ['RECOVERABLE_PENDING', 'RETURNED_TO_MERCHANT', 'UNRECOVERABLE'],
  })
  recovery?: 'RECOVERABLE_PENDING' | 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';

  @Prop({ type: Date, required: true })
  paidToMerchantAt!: Date;

  @Prop({ type: Date })
  collectedAt?: Date;

  @Prop({ type: Date })
  handedOverAt?: Date;

  /** The most recent batch that moved this record. */
  @Prop({ type: String })
  handoverBatchId?: string;

  /** Every batch that moved it, oldest first. */
  @Prop({ type: [String], default: [] })
  handoverBatchIds!: string[];
}

export type DriverDeliveryCashDocument = HydratedDocument<DriverDeliveryCash>;
export const DriverDeliveryCashSchema = SchemaFactory.createForClass(DriverDeliveryCash);

/** One record per delivery - the idempotency guard for merchant pickup. */
DriverDeliveryCashSchema.index(
  { orderId: 1 },
  { unique: true, name: 'uniq_driver_delivery_cash_order' },
);

/** A driver's open records, oldest first - the handover allocation order. */
DriverDeliveryCashSchema.index(
  { driverId: 1, status: 1, paidToMerchantAt: 1 },
  { name: 'idx_driver_delivery_cash_driver_status_age' },
);

/** Reconciliation windows and the stale-collection flag. */
DriverDeliveryCashSchema.index(
  { paidToMerchantAt: -1 },
  { name: 'idx_driver_delivery_cash_recent' },
);
