import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefundRequestDocument = RefundRequest & Document;

@Schema({ timestamps: true, collection: 'refund_requests' })
export class RefundRequest {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['consumer_cancel', 'merchant_cancel', 'anomalous_payment', 'admin'],
    required: true,
  })
  reason!: string;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  @Prop({ type: String })
  providerReference?: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'completed', 'rejected'],
    default: 'pending',
  })
  status!: string;

  @Prop({ type: String })
  externalRefundReference?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  completedBy?: Types.ObjectId;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: String })
  notes?: string;
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);

RefundRequestSchema.index({ orderId: 1 }, { unique: true });
RefundRequestSchema.index({ status: 1, createdAt: -1 });
