import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/** The actions an opt-out record can be audited for. */
export type OptOutAuditAction =
  | 'opt_out'
  | 'opt_in'
  | 'status_change'
  | 'expired'
  | 'revoked'
  | 'created'
  | 'updated';

/**
 * Audit trail for an OptOutRecord — one row per event.
 *
 * This was an embedded `auditLog` array on OptOutRecord, appended by a `pre('save')`
 * hook and an `addAuditEntry` method, with no cap. Two problems:
 *
 * 1. Unbounded growth toward the 16 MB document limit. Bounded in practice by how
 *    often one number toggles, but nothing enforced it, and no retention policy
 *    could be applied to an embedded array.
 * 2. It loaded on *every* read of the record, including the many that do not ask
 *    for it — the three read sites are all gated behind an `includeAuditLog` flag.
 *    Moving it out makes the common path cheaper, not just safer.
 *
 * SMS opt-out is a compliance record, so retention here is deliberately longer than
 * the parent's: OptOutRecord has its own TTL on `expiresAt` which deletes the whole
 * record, and the audit of *why* someone was opted out should outlive it.
 */
@Schema({ timestamps: true, collection: 'sms_opt_out_audit' })
export class OptOutAudit {
  @Prop({ type: Types.ObjectId, ref: 'OptOutRecord', required: true })
  recordId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  action!: OptOutAuditAction;

  @Prop({ type: Date, required: true, default: Date.now })
  timestamp!: Date;

  @Prop({ type: String })
  reason?: string | undefined;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId | undefined;

  @Prop({ type: String })
  ipAddress?: string | undefined;

  @Prop({ type: String })
  userAgent?: string | undefined;

  @Prop({ type: Object })
  metadata?: Record<string, unknown> | undefined;
}

export type OptOutAuditDocument = OptOutAudit & Document;
export const OptOutAuditSchema = SchemaFactory.createForClass(OptOutAudit);

/**
 * `recordId` leads: every read is "the history of this record", including the
 * batched `$in` lookup that serves list endpoints. `timestamp` descending returns
 * newest-first without a sort.
 */
OptOutAuditSchema.index({ recordId: 1, timestamp: -1 });

/**
 * Retention: 2 years, matching AdminAuditLog. Opt-out consent is the kind of record
 * a carrier or regulator can ask about long after the fact, but the collection must
 * still be bounded — which is the whole point of it no longer being an array.
 */
OptOutAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });
