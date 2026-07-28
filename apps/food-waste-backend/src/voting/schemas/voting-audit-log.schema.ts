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

/**
 * This collection is currently write-only — `voting.service.ts` appends a row on
 * every cycle status transition and nothing reads it yet. It had no indexes at
 * all, which is fine while nothing queries it and useless the moment something
 * does: reconstructing one cycle's history would scan the whole collection.
 *
 * `cycleId` leads because every plausible read is "the history of this cycle",
 * with `createdAt` descending to get the transitions newest-first without a sort.
 */
VotingAuditLogSchema.index({ cycleId: 1, createdAt: -1 });

/**
 * Retention: 2 years, matching `AdminAuditLog`. These rows record who moved a
 * cycle between states, and a cycle awards a real prize — so the window needs to
 * outlast any plausible dispute, but the collection must still be bounded. It
 * grows on every transition forever otherwise.
 */
VotingAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });
