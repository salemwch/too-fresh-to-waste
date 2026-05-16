import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class WaitlistEntry {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ default: false })
  notified!: boolean;

  @Prop({ default: 'web_modal' })
  source!: string;
}

export type WaitlistEntryDocument = WaitlistEntry & Document;
export const WaitlistEntrySchema = SchemaFactory.createForClass(WaitlistEntry);

WaitlistEntrySchema.index({ email: 1 }, { unique: true });
WaitlistEntrySchema.index({ notified: 1, createdAt: -1 });
