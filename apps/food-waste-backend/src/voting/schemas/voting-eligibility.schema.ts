import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class VotingEligibility {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  bagsSavedInCycle!: number;

  @Prop({ required: true })
  pointsSnapshot!: number;

  @Prop({ type: Date, required: true })
  snapshotAt!: Date;
}

export type VotingEligibilityDocument = VotingEligibility & Document;
export const VotingEligibilitySchema = SchemaFactory.createForClass(VotingEligibility);

VotingEligibilitySchema.index({ cycleId: 1, userId: 1 }, { unique: true });
VotingEligibilitySchema.index({ cycleId: 1, bagsSavedInCycle: -1 });
