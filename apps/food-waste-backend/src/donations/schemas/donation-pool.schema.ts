import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { DonationGoalCategory } from '@foodwaste/shared';

export type DonationPoolDocument = DonationPool & Document;

/**
 * Status of the donation pool
 */
export enum DonationPoolStatus {
  ACTIVE = 'active',
  FUNDED = 'funded',
  DISTRIBUTED = 'distributed',
  ARCHIVED = 'archived',
  SEASON_COMPLETE = 'season_complete',
}

/**
 * Distribution history entry for tracking where donations went
 */
export interface DistributionHistoryEntry {
  amount: number;
  mealCount: number;
  beneficiaryOrganization: string;
  distributedAt: Date;
  receipts: string[];
  notes?: string;
  distributedBy: Types.ObjectId;
}

/**
 * Metadata for donation pool tracking and analytics
 */
export interface DonationPoolMetadata {
  createdBy?: Types.ObjectId;
  lastUpdatedBy?: Types.ObjectId;
  campaignId?: string;
  targetDate?: Date;
  description?: string;
  impactArea?: string;
  partnerOrganizations?: string[];
}

/**
 * DonationPool Schema
 * Tracks the global donation pool that accumulates from all orders
 * Enterprise-grade with full audit trail and distribution tracking
 */
@Schema({ timestamps: true })
export class DonationPool {
  @Prop({ required: true, default: 0, min: 0 })
  currentAmount!: number;

  @Prop({ required: true, default: 1000, min: 0 })
  targetAmount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  mealCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  contributorCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalDistributed!: number;

  @Prop({ type: String, enum: DonationPoolStatus, default: DonationPoolStatus.ACTIVE })
  status!: DonationPoolStatus;

  @Prop({ required: true, default: 'Community Food Relief' })
  cause!: string;

  @Prop({
    type: String,
    enum: DonationGoalCategory,
    required: true,
    default: DonationGoalCategory.TSHIRTS,
  })
  activeGoalCategory!: DonationGoalCategory;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date })
  targetDate?: Date;

  @Prop({
    type: [
      {
        amount: { type: Number, required: true, min: 0 },
        mealCount: { type: Number, required: true, min: 0 },
        beneficiaryOrganization: { type: String, required: true },
        distributedAt: { type: Date, required: true },
        receipts: { type: [String], default: [] },
        notes: String,
        distributedBy: { type: Types.ObjectId, ref: 'User', required: true },
      },
    ],
    default: [],
  })
  distributionHistory!: DistributionHistoryEntry[];

  @Prop({ type: Object })
  metadata?: DonationPoolMetadata;

  @Prop({ required: true, default: 1, min: 1 })
  season!: number;

  @Prop({ required: true, default: 0, min: 0 })
  goalIndex!: number;

  @Prop({ type: [String], enum: DonationGoalCategory, default: [] })
  completedGoals!: DonationGoalCategory[];

  @Prop({ default: false })
  isArchived!: boolean;

  @Prop({ type: Date })
  archivedAt?: Date;
}

export const DonationPoolSchema = SchemaFactory.createForClass(DonationPool);

// Indexes for performance optimization
DonationPoolSchema.index({ status: 1, isArchived: 1 });
DonationPoolSchema.index({ startDate: -1 });
DonationPoolSchema.index({ createdAt: -1 });
DonationPoolSchema.index({ season: 1, status: 1 });

// Virtual for calculating progress percentage
DonationPoolSchema.virtual('progressPercentage').get(function (this: DonationPoolDocument) {
  if (this.targetAmount === 0) {
    return 0;
  }
  return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
});

// Virtual for checking if target is reached
DonationPoolSchema.virtual('isTargetReached').get(function (this: DonationPoolDocument) {
  return this.currentAmount >= this.targetAmount;
});

// Ensure virtuals are included in JSON
DonationPoolSchema.set('toJSON', { virtuals: true });
DonationPoolSchema.set('toObject', { virtuals: true });
