import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
    userId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Order' })
    orderId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'DonationPool', index: true })
    donationPoolId: Types.ObjectId;

    @Prop({ required: true, min: 0 })
    amount: number;

    @Prop({ required: true, default: 'TND' })
    currency: string;

    @Prop({ type: Date, required: true, default: Date.now, index: true })
    contributedAt: Date;

    @Prop({ default: false })
    isAnonymous: boolean;

    @Prop({ type: [String], enum: DonationBadge, default: [] })
    badgesEarned: DonationBadge[];

    @Prop({ type: Object })
    metadata?: UserDonationMetadata;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop({ type: Date })
    deletedAt?: Date;
}

export const UserDonationSchema = SchemaFactory.createForClass(UserDonation);

// Compound indexes for efficient queries
UserDonationSchema.index({ userId: 1, contributedAt: -1 });
UserDonationSchema.index({ donationPoolId: 1, userId: 1 });
UserDonationSchema.index({ orderId: 1 }, { unique: true });
UserDonationSchema.index({ isDeleted: 1, userId: 1 });
UserDonationSchema.index({ createdAt: -1 });
