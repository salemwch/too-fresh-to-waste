import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ModerationActionDocument = ModerationAction & Document;

export enum ModerationActionType {
  WARN = 'warn',
  SUSPEND = 'suspend',
  BAN = 'ban',
  DELETE_CONTENT = 'delete_content',
  HIDE_CONTENT = 'hide_content',
  RESTRICT_FEATURES = 'restrict_features',
  REQUIRE_VERIFICATION = 'require_verification',
  DEMONETIZE = 'demonetize',
}

export enum ModerationActionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  APPEALED = 'appealed',
}

export enum ModerationSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

@Schema({ timestamps: true })
export class ModerationAction {
  @Prop({ type: String, enum: ModerationActionType, required: true })
  actionType!: ModerationActionType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  targetUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  moderatorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Report' })
  relatedReportId?: Types.ObjectId;

  @Prop({ type: String, enum: ModerationSeverity, required: true })
  severity!: ModerationSeverity;

  @Prop({ required: true, maxlength: 1000 })
  reason!: string;

  @Prop({ maxlength: 2000 })
  details?: string;

  @Prop({
    type: String,
    enum: ModerationActionStatus,
    default: ModerationActionStatus.ACTIVE,
  })
  status!: ModerationActionStatus;

  @Prop({ type: Date })
  expiresAt?: Date | undefined;

  @Prop({ type: Date })
  revokedAt?: Date | undefined;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  revokedBy?: Types.ObjectId | undefined;

  @Prop({ type: String, maxlength: 500 })
  revocationReason?: string | undefined;

  @Prop({ type: [String], default: [] })
  affectedFeatures!: string[];

  @Prop({
    type: {
      ipAddress: String,
      userAgent: String,
      location: {
        country: String,
        region: String,
        city: String,
      },
    },
  })
  actionContext?: {
    ipAddress?: string;
    userAgent?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: false })
  isAppealable!: boolean;

  @Prop({ default: false })
  isSystemAction!: boolean;

  @Prop({
    type: [
      {
        field: String,
        oldValue: String,
        newValue: String,
        changedBy: { type: Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  auditTrail!: Array<{
    field: string;
    oldValue?: string | undefined;
    newValue?: string | undefined;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }>;
}

export const ModerationActionSchema = SchemaFactory.createForClass(ModerationAction);

// Compound indexes for efficient querying
ModerationActionSchema.index({ targetUserId: 1, status: 1, createdAt: -1 });
ModerationActionSchema.index({ moderatorId: 1, createdAt: -1 });
ModerationActionSchema.index({ actionType: 1, severity: 1, status: 1 });
ModerationActionSchema.index({ relatedReportId: 1 }, { sparse: true });
