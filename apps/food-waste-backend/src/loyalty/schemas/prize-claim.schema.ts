import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PrizeClaimDocument = PrizeClaim & Document;

/**
 * What kind of thing was won.
 *
 * `GRAND_PRIZE` is whatever the community voted for that season — a phone, a
 * scooter, a hotel stay, a gym year, a voucher. The specific item is recorded
 * in `prizeName` / `prizeCategory` rather than encoded here, because the
 * catalogue is admin-defined per cycle (`VotingCycle.prizes`) and an enum
 * cannot track it.
 *
 * `SMARTPHONE` is kept only so historical claims still read; nothing writes it.
 * @deprecated use `GRAND_PRIZE` with `prizeCategory: PHONE`.
 */
export enum PrizeType {
  GRAND_PRIZE = 'grand_prize',
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

  /**
   * The prize as the user was shown it — "Electric Scooter", "1 Year Gym + Protein".
   *
   * Snapshotted at claim time on purpose. An admin editing the cycle's prize
   * catalogue afterwards must not rewrite what someone was told they won.
   */
  @Prop({ type: String })
  prizeName?: string;

  /** `PrizeCategory` from the voting cycle — PHONE, ELECTRIC_SCOOTER, … */
  @Prop({ type: String })
  prizeCategory?: string;

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
 * `VotingCycle` sequence, which counts independently of the `MonthlyBagGoal`
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
