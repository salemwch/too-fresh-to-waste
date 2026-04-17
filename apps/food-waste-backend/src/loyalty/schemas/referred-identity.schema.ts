import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ReferredIdentity {
  @Prop({ required: true, type: String, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  referredUserId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  referrerUserId!: Types.ObjectId;

  @Prop({ required: true, enum: ['consumer', 'merchant'] })
  referredAs!: string;
}

export type ReferredIdentityDocument = ReferredIdentity & Document;
export const ReferredIdentitySchema = SchemaFactory.createForClass(ReferredIdentity);

ReferredIdentitySchema.index({ email: 1 }, { unique: true });
ReferredIdentitySchema.index({ phone: 1 }, { unique: true, sparse: true });
