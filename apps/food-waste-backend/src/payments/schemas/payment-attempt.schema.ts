import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentAttemptDocument = PaymentAttempt & Document;

@Schema({ timestamps: true, collection: 'payment_attempts' })
export class PaymentAttempt {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  attemptNumber!: number;

  @Prop({ type: String, default: 'konnect' })
  provider!: string;

  @Prop({ type: String, required: true })
  reference!: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'expired', 'anomalous'],
    default: 'pending',
  })
  status!: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Date })
  claimedAt?: Date;

  @Prop({ type: Date })
  providerExpiresAt?: Date;

  @Prop({ type: String })
  failedReason?: string;

  @Prop({ type: String })
  konnectPaymentId?: string;
}

export const PaymentAttemptSchema = SchemaFactory.createForClass(PaymentAttempt);

PaymentAttemptSchema.index({ reference: 1 }, { unique: true });
PaymentAttemptSchema.index({ orderId: 1, attemptNumber: 1 }, { unique: true });
PaymentAttemptSchema.index(
  { orderId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
