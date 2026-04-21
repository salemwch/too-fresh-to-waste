import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantGoalDocument = MerchantGoal & Document;

@Schema({ timestamps: true })
export class MerchantGoal {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  /** Monthly bag-saving target set by the merchant (default: 300) */
  @Prop({ required: true, default: 300, min: 10, max: 10_000 })
  targetBagsPerMonth!: number;
}

export const MerchantGoalSchema = SchemaFactory.createForClass(MerchantGoal);
MerchantGoalSchema.index({ merchantId: 1 }, { unique: true });
