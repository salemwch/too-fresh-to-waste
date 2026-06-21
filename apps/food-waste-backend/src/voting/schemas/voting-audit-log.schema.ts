import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VotingAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId | undefined;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  fromStatus!: string;

  @Prop({ required: true })
  toStatus!: string;
}

export type VotingAuditLogDocument = VotingAuditLog & Document;
export const VotingAuditLogSchema = SchemaFactory.createForClass(VotingAuditLog);
