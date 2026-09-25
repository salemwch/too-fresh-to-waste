import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlatformTransactionDocument = PlatformTransaction & Document;

/**
 * TFTW's own ledger: what the platform earned, collected and pledged.
 *
 * Entries, and when they are written:
 * - COMMISSION_EARNED   the commission a completed sale accrues (19% of a NORMAL
 *                       sale, 0 on a SETTLEMENT sale), in the completion
 *                       transaction - by CommissionService, every payment method.
 * - COMMISSION_SETTLED  commission collected back from the merchant by a
 *                       settlement sale. Cash collected, not new revenue.
 * - DONATION            the charity pledge of a completed order, written with
 *                       the donation-pool contribution - by DonationsService.
 * - NET_COMMISSION      LEGACY. Booked at online payment time before the
 *                       commission-settlement model; kept so historic rows and
 *                       their refunds still read correctly. No longer written.
 * - PAYMENT_FEE / PAYOUT_FEE  provider fees.
 *
 * A reversal is the same type with a negative amount and a `REVERSAL-` or
 * `REFUND-` reference, so every type still sums to its true net.
 */
export const PLATFORM_TRANSACTION_TYPES = [
  'COMMISSION_EARNED',
  'COMMISSION_SETTLED',
  'DONATION',
  'NET_COMMISSION',
  'PAYMENT_FEE',
  'PAYOUT_FEE',
] as const;

export type PlatformTransactionType = (typeof PLATFORM_TRANSACTION_TYPES)[number];

@Schema({ timestamps: true, collection: 'platform_transactions' })
export class PlatformTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: String })
  payoutBatchId?: string;

  @Prop({
    type: String,
    enum: PLATFORM_TRANSACTION_TYPES,
    required: true,
  })
  type!: PlatformTransactionType;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  @Prop({ type: String, required: true })
  reference!: string;

  @Prop({ type: String })
  notes?: string;
}

export const PlatformTransactionSchema = SchemaFactory.createForClass(PlatformTransaction);

PlatformTransactionSchema.index({ reference: 1 }, { unique: true });
PlatformTransactionSchema.index({ orderId: 1 });
PlatformTransactionSchema.index({ type: 1, createdAt: -1 });
