import { CycleStatus, PrizeCategory } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class PrizeOption {
  _id!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: String })
  imageUrl?: string;

  @Prop({ required: true, enum: PrizeCategory })
  category!: PrizeCategory;

  @Prop({ required: true })
  value!: string;
}

export const PrizeOptionSchema = SchemaFactory.createForClass(PrizeOption);

@Schema({ _id: false })
export class VotingWinner {
  @Prop({ type: Types.ObjectId, required: true })
  prizeId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  totalWeightedVotes!: number;

  @Prop({ required: true })
  voterCount!: number;

  @Prop({ type: Date, required: true })
  announcedAt!: Date;
}

export const VotingWinnerSchema = SchemaFactory.createForClass(VotingWinner);

@Schema({ timestamps: true })
export class VotingCycle {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: Date, required: true })
  cycleStartDate!: Date;

  @Prop({ type: Date, required: true })
  cycleEndDate!: Date;

  @Prop({ required: true })
  seasonBagTarget!: number;

  @Prop({ type: Date })
  seasonGoalMetAt?: Date | undefined;

  @Prop({ type: Date })
  ballotOpensAt?: Date | undefined;

  @Prop({ type: Date })
  ballotClosesAt?: Date | undefined;

  @Prop({ required: true })
  cycleNumber!: number;

  @Prop({
    type: String,
    enum: Object.values(CycleStatus),
    default: CycleStatus.DRAFT,
  })
  status!: string;

  /** Bags a user must save during the season before they may vote. */
  @Prop({ default: 25 })
  minimumBags!: number;

  /**
   * How many of the **leaderboard's** top ranks win the voted prize.
   *
   * Admin-configurable per cycle — the default is 3, but a season can be run
   * with 5. Not the number of voters: see `getPrizeWinners`.
   */
  @Prop({ default: 3 })
  recipientCount!: number;

  @Prop({ type: [PrizeOptionSchema] })
  prizes!: PrizeOption[];

  @Prop({ type: VotingWinnerSchema })
  winner?: VotingWinner | undefined;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy!: Types.ObjectId;

  @Prop({ type: Boolean, default: null })
  isLive?: boolean | null;

  @Prop({ type: Boolean, default: false })
  snapshotReady!: boolean;

  @Prop({ default: 0 })
  seasonBagProgress!: number;

  @Prop({ type: Types.ObjectId })
  winnerPrizeId?: Types.ObjectId | undefined;
}

export type VotingCycleDocument = VotingCycle & Document;
export const VotingCycleSchema = SchemaFactory.createForClass(VotingCycle);

VotingCycleSchema.index({ cycleNumber: 1 }, { unique: true });
VotingCycleSchema.index({ status: 1 });
VotingCycleSchema.index({ isLive: 1 }, { unique: true, partialFilterExpression: { isLive: true } });
VotingCycleSchema.index({ winnerPrizeId: 1 }, { sparse: true });
