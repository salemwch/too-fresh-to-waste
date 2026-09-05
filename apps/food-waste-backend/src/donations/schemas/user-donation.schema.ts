import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';

import { DonationGoalCategory } from '@foodwaste/shared';

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

  /**
   * The merchant whose sale produced this contribution. Denormalized rather
   * than joined through the order: the merchant ledger is read on every
   * dashboard load, and a $lookup between user_donations and orders on that
   * path is the N+1-shaped cost .claude/rules/performance.md rule 7 forbids.
   */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  establishmentId?: Types.ObjectId;

  /**
   * The goal the pool was funding at the moment of contribution. Captured here
   * because DonationPool.activeGoalCategory rotates in place - reading it later
   * returns today's goal, not the one this money went to.
   */
  @Prop({ type: String, enum: DonationGoalCategory })
  goalCategoryAtContribution?: DonationGoalCategory;

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
UserDonationSchema.index({ merchantId: 1, contributedAt: -1 });
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
