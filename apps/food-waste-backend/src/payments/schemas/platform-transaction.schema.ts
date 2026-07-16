import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlatformTransactionDocument = PlatformTransaction & Document;

@Schema({ timestamps: true, collection: 'platform_transactions' })
export class PlatformTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: String })
  payoutBatchId?: string;

  @Prop({
    type: String,
    enum: ['NET_COMMISSION', 'DONATION', 'PAYMENT_FEE', 'PAYOUT_FEE'],
    required: true,
  })
  type!: 'NET_COMMISSION' | 'DONATION' | 'PAYMENT_FEE' | 'PAYOUT_FEE';

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
