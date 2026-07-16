import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantWalletDocument = MerchantWallet & Document;

@Schema({ timestamps: true, collection: 'merchant_wallets' })
export class MerchantWallet {
  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  merchantId!: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  availableBalance!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  pendingBalance!: number;

  @Prop({ type: String, default: 'TND' })
  currency!: string;
}

export const MerchantWalletSchema = SchemaFactory.createForClass(MerchantWallet);

MerchantWalletSchema.index({ establishmentId: 1 }, { unique: true });
