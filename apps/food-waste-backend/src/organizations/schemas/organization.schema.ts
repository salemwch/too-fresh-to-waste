import { OrganizationStatus } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name!: string;

  @Prop({ type: String })
  logo?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: OrganizationStatus,
    default: OrganizationStatus.PENDING,
  })
  status!: OrganizationStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Establishment' }], default: [] })
  establishmentIds!: Types.ObjectId[];

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ ownerId: 1 }, { unique: true });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ establishmentIds: 1 });
