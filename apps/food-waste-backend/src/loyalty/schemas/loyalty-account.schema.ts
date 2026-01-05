import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BadgeType {
  NEWCOMER = 'newcomer',
  ECO_WARRIOR = 'eco_warrior',
  FREQUENT_SAVER = 'frequent_saver',
  EARLY_BIRD = 'early_bird',
  NIGHT_OWL = 'night_owl',
  LOYAL_CUSTOMER = 'loyal_customer',
  SUPER_SAVER = 'super_saver',
  COMMUNITY_CHAMPION = 'community_champion',
  STREAK_MASTER = 'streak_master',
  REFERRAL_CHAMPION = 'referral_champion',
  BUSINESS_RECRUITER = 'business_recruiter',
  REVIEWER = 'reviewer',
}

@Schema({ _id: false })
export class Badge {
  @Prop({ required: true, enum: BadgeType })
  type: BadgeType;

  @Prop({ required: true })
  earnedAt: Date;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  iconUrl: string;
}

@Schema({ _id: false })
export class PointTransaction {
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['earned', 'redeemed', 'expired', 'donated'] })
  type: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Offer' })
  offerId?: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  createdAt: Date;

  @Prop()
  expiresAt?: Date;
}

@Schema({ _id: false })
export class Tier {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  minPoints: number;

  @Prop({ required: true })
  multiplier: number;

  @Prop([String])
  benefits: string[];
}

// =============================================================================
// GAMIFICATION: Friend Referral Tracking
// =============================================================================

export enum FriendReferralStatus {
  PENDING = 'pending',           // Friend signed up, hasn't bought 10 bags yet
  COMPLETED = 'completed',       // Friend bought 10 bags, points awarded
  EXPIRED = 'expired',           // First month passed without 10 bags
}

@Schema({ _id: false })
export class FriendReferral {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  friendUserId: Types.ObjectId;

  @Prop({ required: true })
  referredAt: Date;

  @Prop({ required: true })
  expiresAt: Date; // 30 days from referredAt

  @Prop({ required: true, default: 0 })
  friendBagCount: number;

  @Prop({ required: true, enum: FriendReferralStatus, default: FriendReferralStatus.PENDING })
  status: FriendReferralStatus;

  @Prop()
  completedAt?: Date;

  @Prop({ default: 0 })
  pointsAwarded: number;
}

// =============================================================================
// GAMIFICATION: Business Referral Tracking
// =============================================================================

export enum BusinessReferralStatus {
  PENDING = 'pending',           // Business signed up, hasn't sold 30 orders yet
  COMPLETED = 'completed',       // Business sold 30 orders, points awarded
  EXPIRED = 'expired',           // First month passed without 30 orders
}

@Schema({ _id: false })
export class BusinessReferral {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  businessUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  establishmentId?: Types.ObjectId;

  @Prop({ required: true })
  referredAt: Date;

  @Prop({ required: true })
  expiresAt: Date; // 30 days from referredAt

  @Prop({ required: true, default: 0 })
  businessOrderCount: number;

  @Prop({ required: true, enum: BusinessReferralStatus, default: BusinessReferralStatus.PENDING })
  status: BusinessReferralStatus;

  @Prop()
  completedAt?: Date;

  @Prop({ default: 0 })
  pointsAwarded: number;
}

// =============================================================================
// GAMIFICATION: Login Streak Tracking
// =============================================================================

@Schema({ _id: false })
export class LoginStreak {
  @Prop({ required: true, default: 0 })
  currentStreak: number; // Days in current streak

  @Prop()
  lastLoginDate?: Date; // Last login date (used to check if streak continues)

  @Prop({ default: 0 })
  pointsEarnedThisMonth: number; // Max 20 points/month (10 days × 2 pts)

  @Prop()
  monthlyResetDate?: Date; // When this month's streak points reset

  @Prop({ default: 0 })
  longestStreak: number; // Historical best
}

// =============================================================================
// GAMIFICATION: Purchase Streak Tracking
// =============================================================================

@Schema({ _id: false })
export class PurchaseStreak {
  @Prop({ required: true, default: 0 })
  bagsThisPeriod: number; // Bags bought in current 15-day period

  @Prop()
  periodStartDate?: Date; // When current 15-day period started

  @Prop({ default: false })
  completedThisMonth: boolean; // Already earned 10 pts this month?

  @Prop()
  monthlyResetDate?: Date; // When monthly completion flag resets

  @Prop({ default: 0 })
  totalStreaksCompleted: number; // Historical count
}

// =============================================================================
// GAMIFICATION: Review Tracking
// =============================================================================

@Schema({ _id: false })
export class ReviewTracking {
  @Prop({ type: [Types.ObjectId], ref: 'Order', default: [] })
  reviewedOrderIds: Types.ObjectId[]; // Orders already reviewed (prevent duplicate points)

  @Prop({ default: 0 })
  totalReviewsCount: number;

  @Prop({ default: 0 })
  totalReviewPoints: number;
}

// =============================================================================
// MAIN LOYALTY ACCOUNT SCHEMA
// =============================================================================

@Schema({ timestamps: true })
export class LoyaltyAccount {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  totalPoints: number;

  @Prop({ required: true, default: 0, min: 0 })
  availablePoints: number;

  @Prop({ required: true, default: 0, min: 0 })
  lifetimePointsEarned: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalOrdersCount: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalAmountSpent: number;

  @Prop({ required: true, default: 'Bronze' })
  currentTier: string;

  @Prop([Badge])
  badges: Badge[];

  @Prop([PointTransaction])
  pointsHistory: PointTransaction[];

  // Legacy referral (simple signup bonus - now deprecated)
  @Prop({ type: Types.ObjectId, ref: 'User' })
  referredBy?: Types.ObjectId;

  @Prop({ default: 0 })
  referralCount: number;

  @Prop({ default: Date.now })
  joinedAt: Date;

  @Prop()
  lastActivity?: Date;

  @Prop({ default: true })
  isActive: boolean;

  // =============================================================================
  // GAMIFICATION: Referral Code
  // =============================================================================

  @Prop({ unique: true, sparse: true })
  referralCode?: string; // Unique code like "JOHN1234" for sharing

  // =============================================================================
  // GAMIFICATION: Friend Referrals
  // =============================================================================

  @Prop({ type: [FriendReferral], default: [] })
  friendReferrals: FriendReferral[];

  @Prop({ default: 0 })
  friendReferralsCompleted: number;

  // =============================================================================
  // GAMIFICATION: Business Referrals
  // =============================================================================

  @Prop({ type: [BusinessReferral], default: [] })
  businessReferrals: BusinessReferral[];

  @Prop({ default: 0 })
  businessReferralsCompleted: number;

  // =============================================================================
  // GAMIFICATION: Login Streak
  // =============================================================================

  @Prop({ type: LoginStreak, default: () => ({}) })
  loginStreak: LoginStreak;

  // =============================================================================
  // GAMIFICATION: Purchase Streak
  // =============================================================================

  @Prop({ type: PurchaseStreak, default: () => ({}) })
  purchaseStreak: PurchaseStreak;

  // =============================================================================
  // GAMIFICATION: Review Tracking
  // =============================================================================

  @Prop({ type: ReviewTracking, default: () => ({}) })
  reviewTracking: ReviewTracking;
}

export type LoyaltyAccountDocument = LoyaltyAccount & Document;
export const LoyaltyAccountSchema = SchemaFactory.createForClass(LoyaltyAccount);

// =============================================================================
// INDEXES
// =============================================================================

LoyaltyAccountSchema.index({ totalPoints: -1 });
LoyaltyAccountSchema.index({ currentTier: 1 });
LoyaltyAccountSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
LoyaltyAccountSchema.index({ 'friendReferrals.friendUserId': 1 });
LoyaltyAccountSchema.index({ 'friendReferrals.status': 1, 'friendReferrals.expiresAt': 1 });
LoyaltyAccountSchema.index({ 'businessReferrals.businessUserId': 1 });
LoyaltyAccountSchema.index({ 'businessReferrals.status': 1, 'businessReferrals.expiresAt': 1 });
