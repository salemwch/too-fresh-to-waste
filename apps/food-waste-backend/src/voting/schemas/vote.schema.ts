import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Vote {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  prizeId!: Types.ObjectId;

  @Prop({ required: true })
  pointsSnapshot!: number;

  @Prop({ type: Date, required: true })
  votedAt!: Date;
}

export type VoteDocument = Vote & Document;
export const VoteSchema = SchemaFactory.createForClass(Vote);

VoteSchema.index({ cycleId: 1, userId: 1 }, { unique: true });
VoteSchema.index({ cycleId: 1, prizeId: 1 });
