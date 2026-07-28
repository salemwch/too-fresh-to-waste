import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Field-level change history for a ModerationAction.
 *
 * This was an embedded `auditTrail` array on ModerationAction itself, appended by
 * four call sites with no cap. Every embedded array is bounded by the 16 MB
 * document limit, and an append-only trail has no natural end — an action that is
 * updated repeatedly grows its parent document until writes start failing. It also
 * made the parent more expensive to read for every consumer, none of which wanted
 * the trail: nothing in the codebase read it.
 *
 * One row per change instead. The parent document stays small, history is
 * unbounded without risking the document limit, and retention can be enforced by
 * a TTL, which is impossible for an embedded array.
 */
@Schema({ timestamps: true, collection: 'moderation_action_audit' })
export class ModerationActionAudit {
  @Prop({ type: Types.ObjectId, ref: 'ModerationAction', required: true })
  actionId!: Types.ObjectId;

  @Prop({ required: true })
  field!: string;

  @Prop({ type: String })
  oldValue?: string | undefined;

  @Prop({ type: String })
  newValue?: string | undefined;

  /**
   * The moderator who made the change. For an automated transition (the
   * expiry sweep) this is the action's original moderator, matching the previous
   * embedded behaviour — there is no system user to attribute it to.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  changedAt!: Date;
}

export type ModerationActionAuditDocument = ModerationActionAudit & Document;
export const ModerationActionAuditSchema = SchemaFactory.createForClass(ModerationActionAudit);

/**
 * `actionId` leads: every read is "the history of this action". `changedAt`
 * descending returns the newest change first without an in-memory sort.
 */
ModerationActionAuditSchema.index({ actionId: 1, changedAt: -1 });

/**
 * Retention: 2 years, matching AdminAuditLog and VotingAuditLog. Moderation
 * decisions can be appealed, so the window has to outlast any plausible dispute —
 * but the collection must still be bounded, which is the whole reason this is no
 * longer an embedded array.
 */
ModerationActionAuditSchema.index({ changedAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });
