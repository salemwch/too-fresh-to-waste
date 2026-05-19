import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnterpriseInquiryDocument = EnterpriseInquiry & Document;

@Schema({ timestamps: true, collection: 'enterprise_inquiries' })
export class EnterpriseInquiry {
  @Prop({ required: true, trim: true })
  companyName!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ trim: true, default: '' })
  message!: string;
}

export const EnterpriseInquirySchema = SchemaFactory.createForClass(EnterpriseInquiry);
EnterpriseInquirySchema.index({ email: 1 });
EnterpriseInquirySchema.index({ createdAt: -1 });
