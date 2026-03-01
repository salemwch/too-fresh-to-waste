import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommunityBagGoalDocument = CommunityBagGoal & Document;

export enum CommunityGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true })
export class CommunityBagGoal {
  @Prop({ required: true, default: 0, min: 0 })
  currentCount: number;

  @Prop({ required: true, default: 8000, min: 100 })
  targetCount: number;

  @Prop({ required: true, default: 1, min: 1 })
  cycleNumber: number;

  @Prop({
    required: true,
    enum: CommunityGoalStatus,
    default: CommunityGoalStatus.ACTIVE,
    index: true,
  })
  status: CommunityGoalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  resetAt?: Date;
}

export const CommunityBagGoalSchema = SchemaFactory.createForClass(CommunityBagGoal);

// Index for fast lookup of the single active goal
CommunityBagGoalSchema.index({ status: 1 });
// Compound index for history queries (admin)
CommunityBagGoalSchema.index({ cycleNumber: -1 });
