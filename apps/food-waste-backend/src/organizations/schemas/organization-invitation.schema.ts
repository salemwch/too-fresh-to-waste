import { InvitationStatus, OrganizationRole } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationInvitationDocument = OrganizationInvitation & Document;

@Schema({ timestamps: true })
export class OrganizationInvitation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, enum: OrganizationRole, default: OrganizationRole.LOCATION_MANAGER })
  role!: OrganizationRole;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  assignedEstablishmentId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  invitedBy!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedBy?: Types.ObjectId;

  @Prop({ type: Date })
  acceptedAt?: Date;
}

export const OrganizationInvitationSchema = SchemaFactory.createForClass(OrganizationInvitation);

OrganizationInvitationSchema.index({ token: 1 }, { unique: true });
OrganizationInvitationSchema.index({ organizationId: 1, status: 1 });
OrganizationInvitationSchema.index({ email: 1, status: 1 });
OrganizationInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
