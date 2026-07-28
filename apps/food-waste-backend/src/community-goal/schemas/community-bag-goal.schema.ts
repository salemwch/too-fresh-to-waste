import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MonthlyBagGoalDocument = MonthlyBagGoal & Document;

export enum MonthlyGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/** Extensible — add new values here and to the shared MonthlyGoalCauseType enum */
export enum MonthlyGoalCauseType {
  FOOD = 'FOOD',
  CLOTHING = 'CLOTHING',
  EDUCATION = 'EDUCATION',
  MEDICINE = 'MEDICINE',
}

@Schema({ timestamps: true })
export class MonthlyBagGoal {
  @Prop({ required: true, default: 0, min: 0 })
  currentCount!: number;

  @Prop({ required: true, default: 8000, min: 100 })
  targetCount!: number;

  @Prop({ required: true, default: 1, min: 1 })
  cycleNumber!: number;

  @Prop({
    required: true,
    enum: MonthlyGoalStatus,
    default: MonthlyGoalStatus.ACTIVE,
  })
  status!: MonthlyGoalStatus;

  @Prop({ type: String, enum: MonthlyGoalCauseType })
  causeType?: MonthlyGoalCauseType;

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

export const MonthlyBagGoalSchema = SchemaFactory.createForClass(MonthlyBagGoal);

// Index for fast lookup of the single active goal
MonthlyBagGoalSchema.index({ status: 1 });
// Compound index for history queries (admin)
MonthlyBagGoalSchema.index({ cycleNumber: -1 });
MonthlyBagGoalSchema.index({ status: 1, participantIds: 1 });
