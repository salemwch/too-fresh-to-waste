import { Logger } from '@nestjs/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { OptOutAudit, type OptOutAuditAction } from './opt-out-audit.schema';

/**
 * Resolved through `doc.$model()` rather than an injected model, because these are
 * schema hooks — there is no DI container inside them. The name must match the
 * `MongooseModule.forFeature` registration in `notifications.module.ts`.
 */
const OPT_OUT_AUDIT_MODEL = OptOutAudit.name;

/** An audit entry built in `pre('save')`, written in `post('save')`. */
interface StagedAuditEntry {
  action: OptOutAuditAction;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Carries staged entries between the two hooks. Not a schema field — it lives only
 * on the in-memory document and is never persisted.
 */
interface StagedAuditCarrier {
  $pendingAudit?: StagedAuditEntry[];
}

interface IOptOutRecordMethods {
  addAuditEntry(
    action: OptOutAuditAction,
    reason?: string,
    userId?: Types.ObjectId,
    metadata?: Record<string, unknown>,
  ): Promise<OptOutRecordDocument>;
  isExpired(): boolean;
  canReceiveMessageType(messageType: string): boolean;
}

export type OptOutRecordDocument = OptOutRecord & Document & IOptOutRecordMethods;

export enum OptOutReason {
  USER_REQUESTED = 'user_requested',
  ADMIN_ACTION = 'admin_action',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  SPAM_REPORT = 'spam_report',
  CARRIER_BLOCK = 'carrier_block',
  INVALID_NUMBER = 'invalid_number',
  BOUNCED_MESSAGE = 'bounced_message',
  FRAUD_PREVENTION = 'fraud_prevention',
  GDPR_REQUEST = 'gdpr_request',
  CCPA_REQUEST = 'ccpa_request',
}

export enum OptOutStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum OptOutScope {
  ALL_SMS = 'all_sms',
  MARKETING_ONLY = 'marketing_only',
  TRANSACTIONAL_ONLY = 'transactional_only',
  ORDER_UPDATES = 'order_updates',
  PROMOTIONAL = 'promotional',
  SECURITY_ALERTS = 'security_alerts',
}

@Schema({
  timestamps: true,
  collection: 'sms_opt_out_records',
})
export class OptOutRecord {
  @Prop({
    required: true,
    validate: {
      validator(v: string) {
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Phone number must be in E.164 format',
    },
  })
  phoneNumber!: string;

  @Prop({
    required: true,
    enum: OptOutStatus,
    default: OptOutStatus.ACTIVE,
  })
  status!: OptOutStatus;

  @Prop({ required: true, default: true })
  isOptedOut!: boolean;

  @Prop({
    required: true,
    enum: OptOutScope,
    default: OptOutScope.ALL_SMS,
  })
  scope!: OptOutScope;

  @Prop({
    required: true,
    enum: OptOutReason,
    default: OptOutReason.USER_REQUESTED,
  })
  reason!: OptOutReason;

  @Prop({ required: true, default: Date.now })
  optedOutAt!: Date;

  @Prop()
  optedInAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  source?: string;

  @Prop({ type: Object })
  metadata?: {
    campaign?: string;
    messageId?: string;
    errorCode?: string;
    carrierResponse?: string;
    adminUserId?: string;
    requestId?: string;
    complianceReference?: string;
    originalMessage?: string;
    [key: string]: string | number | boolean | Date | undefined;
  };

  /*
   * The `auditLog` array that used to live here now lives in its own collection —
   * see `opt-out-audit.schema.ts`. It was appended without a cap, and it loaded on
   * every read of this record even though all three read sites gate it behind an
   * `includeAuditLog` flag.
   */

  @Prop({ default: 0 })
  retryCount!: number;

  @Prop()
  lastVerifiedAt?: Date;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop()
  verificationToken?: string;

  @Prop({ type: [String], default: [] })
  blockedSenders!: string[];

  @Prop({ type: [String], default: [] })
  allowedSenders!: string[];

  @Prop({
    type: {
      lastMessageSent: Date,
      lastMessageDelivered: Date,
      totalMessagesSent: { type: Number, default: 0 },
      totalMessagesDelivered: { type: Number, default: 0 },
      totalMessagesFailed: { type: Number, default: 0 },
    },
  })
  messageStats?: {
    lastMessageSent?: Date;
    lastMessageDelivered?: Date;
    totalMessagesSent: number;
    totalMessagesDelivered: number;
    totalMessagesFailed: number;
  };

  @Prop({
    type: {
      processingStarted: Date,
      processingCompleted: Date,
      processingStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'] },
      processingErrors: [String],
      batchId: String,
    },
  })
  processingInfo?: {
    processingStarted?: Date;
    processingCompleted?: Date;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    processingErrors: string[];
    batchId?: string;
  };

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const OptOutRecordSchema = SchemaFactory.createForClass(OptOutRecord);

// Compound indexes for efficient queries
OptOutRecordSchema.index({ phoneNumber: 1, status: 1 });
OptOutRecordSchema.index({ phoneNumber: 1, isOptedOut: 1 });
OptOutRecordSchema.index({ status: 1, createdAt: -1 });
OptOutRecordSchema.index({ userId: 1, status: 1 });
OptOutRecordSchema.index({ optedOutAt: 1 });
OptOutRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Text index for search functionality
OptOutRecordSchema.index({
  phoneNumber: 'text',
  reason: 'text',
  source: 'text',
});

/**
 * Audit logging is split across pre- and post-save on purpose.
 *
 * `pre('save')` is the only place that can still see what changed — `isNew` and
 * `isModified()` are both reset once the save completes. But writing the audit row
 * there would record a change that never happened if the save then failed, and the
 * row now lives in a different collection so it is no longer covered by the same
 * write. So pre-save *stages* the entry on the in-memory document and post-save
 * persists it.
 *
 * A failed audit insert is logged and swallowed: the opt-out itself has already
 * been committed, and refusing to honour an SMS opt-out because its audit row could
 * not be written would be the worse outcome, legally and for the user.
 */
OptOutRecordSchema.pre('save', function (next) {
  const staged: StagedAuditEntry[] = [];

  if (this.isNew) {
    staged.push({
      action: 'created',
      reason: 'Record created',
      metadata: {
        isOptedOut: this.isOptedOut,
        reason: this.reason,
        scope: this.scope,
      },
    });
  } else if (this.isModified('isOptedOut')) {
    staged.push({
      action: this.isOptedOut ? 'opt_out' : 'opt_in',
      ...(this.reason !== undefined ? { reason: this.reason } : {}),
      metadata: {
        previousStatus: !this.isOptedOut,
        newStatus: this.isOptedOut,
        scope: this.scope,
      },
    });
  }

  // Cast to the carrier alone: inside a hook `this` is the raw Mongoose document
  // type, which does not carry the schema's instance methods.
  (this as unknown as StagedAuditCarrier).$pendingAudit = staged;

  next();
});

OptOutRecordSchema.post('save', async function (doc: OptOutRecordDocument) {
  const carrier = doc as unknown as StagedAuditCarrier;
  const staged = carrier.$pendingAudit ?? [];
  carrier.$pendingAudit = [];

  if (staged.length === 0) {
    return;
  }

  try {
    await doc.$model(OPT_OUT_AUDIT_MODEL).insertMany(
      staged.map(entry => ({ ...entry, recordId: doc._id, timestamp: new Date() })),
      // Persist every row we can rather than losing the batch to one bad entry.
      { ordered: false },
    );
  } catch (error) {
    new Logger('OptOutRecordAudit').error(
      `Failed to write ${staged.length} audit row(s) for opt-out record ${String(doc._id)}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

// Virtual for masked phone number
OptOutRecordSchema.virtual('maskedPhoneNumber').get(function () {
  if (!this.phoneNumber || this.phoneNumber.length < 4) {
    return '****';
  }
  const lastFour = this.phoneNumber.slice(-4);
  const masked = '*'.repeat(this.phoneNumber.length - 4);
  return masked + lastFour;
});

// Instance methods
/**
 * Append an audit entry for this record.
 *
 * Writes straight to the audit collection rather than staging through save(): the
 * caller is recording an event, not changing the record, so there is nothing to
 * save. The previous implementation pushed onto the array and then called `save()`,
 * which meant every audit entry rewrote the whole parent document.
 *
 * Returns the record unchanged, preserving the old signature for callers.
 */
OptOutRecordSchema.methods['addAuditEntry'] = async function (
  this: OptOutRecordDocument,
  action: OptOutAuditAction,
  reason?: string,
  userId?: Types.ObjectId,
  metadata?: Record<string, unknown>,
): Promise<OptOutRecordDocument> {
  await this.$model(OPT_OUT_AUDIT_MODEL).create({
    recordId: this._id,
    action,
    timestamp: new Date(),
    ...(reason !== undefined && { reason }),
    ...(userId !== undefined && { userId }),
    ...(metadata !== undefined && { metadata }),
  });

  return this;
};

OptOutRecordSchema.methods['isExpired'] = function (this: OptOutRecordDocument): boolean {
  const expiresAt = this.expiresAt;
  return expiresAt !== null && expiresAt !== undefined ? new Date() > expiresAt : false;
};

OptOutRecordSchema.methods['canReceiveMessageType'] = function (
  this: OptOutRecordDocument,
  messageType: string,
): boolean {
  const isOptedOut = this['isOptedOut'] as boolean | undefined;
  if (isOptedOut !== true) {
    return true;
  }

  // Always allow critical security messages
  if (messageType === 'security_alert' || messageType === 'fraud_alert') {
    return true;
  }

  // Check scope-specific permissions
  switch (this['scope']) {
    case OptOutScope.ALL_SMS:
      return false;
    case OptOutScope.MARKETING_ONLY:
      return !['marketing', 'promotional'].includes(messageType);
    case OptOutScope.TRANSACTIONAL_ONLY:
      return ['marketing', 'promotional'].includes(messageType);
    case OptOutScope.ORDER_UPDATES:
      return messageType !== 'order_update';
    case OptOutScope.PROMOTIONAL:
      return messageType !== 'promotional';
    case OptOutScope.SECURITY_ALERTS:
      return messageType !== 'security_alert';
    default:
      return false;
  }
};

// Static methods
OptOutRecordSchema.statics['findActiveOptOuts'] = function () {
  return this.find({
    status: OptOutStatus.ACTIVE,
    isOptedOut: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  });
};

OptOutRecordSchema.statics['findByPhoneNumbers'] = function (phoneNumbers: string[]) {
  return this.find({
    phoneNumber: { $in: phoneNumbers },
    status: OptOutStatus.ACTIVE,
  });
};

OptOutRecordSchema.statics['cleanupExpired'] = function () {
  return this.updateMany(
    {
      expiresAt: { $lte: new Date() },
      status: { $ne: OptOutStatus.EXPIRED },
    },
    {
      status: OptOutStatus.EXPIRED,
      isOptedOut: false,
    },
  );
};
