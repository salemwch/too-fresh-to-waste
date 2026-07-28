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

/**
 * Expire only invitations that were never acted on.
 *
 * Without the partial filter this TTL deleted *every* invitation past `expiresAt`,
 * including `accepted` ones — erasing the record of who was granted access to an
 * organisation, which is exactly the history worth keeping. An accepted invitation
 * is a real event; a pending one that lapsed is garbage.
 *
 * `expired` is included alongside `pending` because it is the same thing one step
 * later: `organizations-invitation.service.ts` lazily flips a lapsed `pending`
 * invitation to `expired` when someone clicks a stale link, purely to return a
 * clearer error. Filtering on `pending` alone would leave those tombstones in the
 * collection forever.
 *
 * `accepted` and `revoked` are both deliberate outcomes and are retained. Their
 * volume is bounded by human action, and `createInvitation` already clears stale
 * `accepted`/`expired` rows for an email when it is re-invited.
 *
 * `$in` inside a partialFilterExpression requires MongoDB 6.0+; the cluster runs 8.0.
 * Ref: https://www.mongodb.com/docs/manual/core/index-partial/
 */
OrganizationInvitationSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: {
      status: { $in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] },
    },
  },
);
