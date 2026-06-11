import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommunityBagGoalDocument = CommunityBagGoal & Document;

export enum CommunityGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/** Extensible — add new values here and to the shared CommunityGoalCauseType enum */
export enum CommunityGoalCauseType {
  FOOD = 'FOOD',
  CLOTHING = 'CLOTHING',
  EDUCATION = 'EDUCATION',
  MEDICINE = 'MEDICINE',
}

@Schema({ timestamps: true })
export class CommunityBagGoal {
  @Prop({ required: true, default: 0, min: 0 })
  currentCount!: number;

  @Prop({ required: true, default: 8000, min: 100 })
  targetCount!: number;

  @Prop({ required: true, default: 1, min: 1 })
  cycleNumber!: number;

  @Prop({
    required: true,
    enum: CommunityGoalStatus,
    default: CommunityGoalStatus.ACTIVE,
  })
  status!: CommunityGoalStatus;

  @Prop({ type: String, enum: CommunityGoalCauseType })
  causeType?: CommunityGoalCauseType;

  @Prop({ type: String, maxlength: 80 })
  causeTitle?: string;

  @Prop({ type: String, maxlength: 600 })
  causeDescription?: string;

  @Prop({ type: Number, default: 50, min: 1 })
  rewardPoints?: number;

  @Prop({ type: String, maxlength: 80 })
  seasonName?: string;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  participantIds!: Types.ObjectId[];

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
CommunityBagGoalSchema.index({ status: 1, participantIds: 1 });
