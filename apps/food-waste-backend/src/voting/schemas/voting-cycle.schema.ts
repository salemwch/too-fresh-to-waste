import { CycleStatus, PrizeCategory } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Optional per-language variants of one admin-authored string.
 *
 * `_id: false` because these are values, not documents - a translation has no
 * identity of its own and does not want an ObjectId in every prize.
 */
@Schema({ _id: false })
export class LocalisedTextSchemaClass {
  @Prop({ type: String })
  fr?: string;

  @Prop({ type: String })
  ar?: string;
}

export const LocalisedTextSchema = SchemaFactory.createForClass(LocalisedTextSchemaClass);

@Schema()
export class PrizeOption {
  _id!: Types.ObjectId;

  /**
   * The default, and the English copy. Required: every prize must render
   * something, so resolution always has a floor to fall back to.
   */
  @Prop({ required: true })
  name!: string;

  /**
   * French and Arabic variants, both optional.
   *
   * Optional rather than required on purpose. Prize names are content an admin
   * types, not chrome we ship, so there is no message file to put them in - but
   * forcing three versions of every name and description would mean thirty
   * required inputs for a five-prize cycle. An admin fills the languages they
   * care about; `resolveLocalisedText` gives every other reader the default.
   *
   * Being optional is also what makes this migration-free: existing cycles have
   * no variants and keep rendering exactly as they did.
   */
  @Prop({ type: LocalisedTextSchema })
  nameI18n?: LocalisedTextSchemaClass;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: LocalisedTextSchema })
  descriptionI18n?: LocalisedTextSchemaClass;

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

  /**
   * Bags the community must save for the season's prize to unlock.
   *
   * The default is not decoration. `required` is a write validator, so it does
   * nothing for documents already stored, and without a default Mongoose has
   * nothing to hydrate a missing path with — cycles written before this field
   * existed came back `undefined` and crashed the admin voting page on
   * `.toLocaleString()`. A default makes every future read safe; the cycles
   * already written are handled by
   * `scripts/migrations/backfill-season-bag-target.ts`.
   */
  @Prop({ required: true, default: 30000 })
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
