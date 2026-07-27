import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PrizeClaimDocument = PrizeClaim & Document;

export enum PrizeType {
  SMARTPHONE = 'smartphone',
  DISCOUNT = 'discount',
}

export enum PrizeClaimStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  DELIVERED = 'delivered',
  REJECTED = 'rejected',
}

export enum PrizeSource {
  BAG_GOAL = 'bag_goal',
  VOTING = 'voting',
}

@Schema({ timestamps: true })
export class PrizeClaim {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: PrizeType, required: true })
  prizeType!: PrizeType;

  @Prop({ type: String, enum: PrizeClaimStatus, default: PrizeClaimStatus.PENDING })
  status!: PrizeClaimStatus;

  @Prop({ type: Number, required: true, min: 1 })
  rank!: number;

  @Prop({ type: Number, required: true, min: 1 })
  totalPoints!: number;

  @Prop({ type: Number, required: true, min: 1 })
  cycleNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  establishmentId?: Types.ObjectId;

  @Prop({ type: String })
  establishmentName?: string;

  @Prop({ type: String, unique: true, sparse: true })
  voucherCode?: string;

  @Prop({ type: String, maxlength: 500 })
  adminNotes?: string;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ type: Date })
  deliveredAt?: Date;

  @Prop({ type: String, enum: PrizeSource, default: PrizeSource.BAG_GOAL })
  source!: PrizeSource;

  @Prop({ type: Types.ObjectId, ref: 'VotingCycle' })
  votingCycleId?: Types.ObjectId;
}

export const PrizeClaimSchema = SchemaFactory.createForClass(PrizeClaim);

/**
 * One bag-goal claim per user per season.
 *
 * Scoped to `BAG_GOAL` deliberately. Voting claims store `cycleNumber` from the
 * `VotingCycle` sequence, which counts independently of the `CommunityBagGoal`
 * sequence — so without this filter the two collide as soon as the numbers
 * coincide, and a user who claimed a season prize is refused their voting
 * prize. Voting claims are governed by the partial index below instead.
 */
PrizeClaimSchema.index(
  { userId: 1, cycleNumber: 1 },
  { unique: true, partialFilterExpression: { source: PrizeSource.BAG_GOAL } },
);
PrizeClaimSchema.index({ status: 1, prizeType: 1 });
PrizeClaimSchema.index({ cycleNumber: -1 });
PrizeClaimSchema.index(
  { userId: 1, votingCycleId: 1 },
  { unique: true, partialFilterExpression: { source: PrizeSource.VOTING } },
);
