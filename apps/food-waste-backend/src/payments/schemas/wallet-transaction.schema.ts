import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

@Schema({ timestamps: true, collection: 'wallet_transactions' })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  merchantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PaymentAttempt' })
  paymentAttemptId?: Types.ObjectId;

  @Prop({ type: String })
  payoutBatchId?: string;

  @Prop({ type: String, enum: ['SALE', 'REFUND', 'PAYOUT'], required: true })
  type!: 'SALE' | 'REFUND' | 'PAYOUT';

  @Prop({ type: String, enum: ['CREATED', 'COMPLETED', 'FAILED'], default: 'CREATED' })
  status!: 'CREATED' | 'COMPLETED' | 'FAILED';

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  @Prop({ type: Number })
  orderTotal?: number;

  @Prop({ type: Number })
  merchantAmount?: number;

  @Prop({ type: Number })
  platformFee?: number;

  @Prop({ type: String, required: true })
  reference!: string;

  @Prop({ type: String })
  notes?: string;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);

WalletTransactionSchema.index({ reference: 1 }, { unique: true });
WalletTransactionSchema.index({ establishmentId: 1, createdAt: -1 });
WalletTransactionSchema.index({ orderId: 1 });
WalletTransactionSchema.index({ type: 1, status: 1 });
WalletTransactionSchema.index({ payoutBatchId: 1 });
