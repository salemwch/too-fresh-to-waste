import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';

import { applySoftDeleteFilter } from '../../common/utils/soft-delete-aggregate.util';

export type UserDonationDocument = UserDonation & Document;

/**
 * Badge types for gamification
 */
export enum DonationBadge {
  FIRST_STEP = 'first_step',
  COMMUNITY_HELPER = 'community_helper',
  IMPACT_MAKER = 'impact_maker',
  FOOD_HERO = 'food_hero',
  CHAMPION = 'champion',
}

/**
 * Metadata for user donation tracking
 */
export interface UserDonationMetadata {
  deviceInfo?: string;
  platform?: 'mobile' | 'web';
  sessionId?: string;
  campaignId?: string;
}

/**
 * UserDonation Schema
 * Tracks individual user contributions from each order
 * Enterprise-grade with gamification support and full audit trail
 */
@Schema({ timestamps: true })
export class UserDonation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Order' })
  orderId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'DonationPool' })
  donationPoolId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'TND' })
  currency!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  contributedAt!: Date;

  @Prop({ default: false })
  isAnonymous!: boolean;

  @Prop({ type: [String], enum: DonationBadge, default: [] })
  badgesEarned!: DonationBadge[];

  /** originalPrice - userPrice, computed once at order time. Frontend only renders. */
  @Prop({ required: true, default: 0, min: 0 })
  moneySaved!: number;

  @Prop({ type: Object })
  metadata?: UserDonationMetadata;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: String })
  deletedBy?: string;
}

export const UserDonationSchema = SchemaFactory.createForClass(UserDonation);

// Compound indexes for efficient queries
UserDonationSchema.index({ userId: 1, contributedAt: -1 });
UserDonationSchema.index({ donationPoolId: 1, userId: 1 });
UserDonationSchema.index({ orderId: 1 }, { unique: true });
UserDonationSchema.index({ isDeleted: 1, userId: 1 });
UserDonationSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });
UserDonationSchema.index({ createdAt: -1 });

// =============================================================================
// SOFT-DELETE MIDDLEWARE — Auto-exclude deleted donations from queries
// Bypass with: .setOptions({ includeDeleted: true })
// =============================================================================

UserDonationSchema.pre<Query<UserDonationDocument[], UserDonationDocument>>(
  /^find/,
  function (next) {
    const queryOptions = this.getOptions() as Record<string, unknown> | undefined;
    if (queryOptions?.['includeDeleted'] !== true) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  },
);

UserDonationSchema.pre('aggregate', function () {
  const options = (this as { options?: Record<string, unknown> }).options;
  if (options?.['includeDeleted'] !== true) {
    applySoftDeleteFilter(this);
  }
});
