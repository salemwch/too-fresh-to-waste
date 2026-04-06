import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ModerationLogDocument = ModerationLog & Document;

export enum LogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum LogCategory {
  REPORT_HANDLING = 'report_handling',
  USER_ACTION = 'user_action',
  CONTENT_MODERATION = 'content_moderation',
  SYSTEM_EVENT = 'system_event',
  APPEAL_PROCESS = 'appeal_process',
  BULK_ACTION = 'bulk_action',
}

@Schema({ timestamps: true })
export class ModerationLog {
  @Prop({ type: String, enum: LogLevel, required: true })
  level!: LogLevel;

  @Prop({ type: String, enum: LogCategory, required: true })
  category!: LogCategory;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  targetId?: Types.ObjectId;

  @Prop()
  targetType?: string;

  @Prop({ type: Types.ObjectId, ref: 'Report' })
  relatedReportId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ModerationAction' })
  relatedActionId?: Types.ObjectId;

  @Prop({
    type: {
      ipAddress: String,
      userAgent: String,
      endpoint: String,
      method: String,
      requestId: String,
    },
  })
  requestContext?: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    requestId?: string;
  };

  @Prop({ type: Object, default: {} })
  beforeState?: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  afterState?: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: false })
  isAutomated!: boolean;

  @Prop()
  automationRule?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  errorDetails?: string;

  @Prop()
  stackTrace?: string;
}

export const ModerationLogSchema = SchemaFactory.createForClass(ModerationLog);

// Compound indexes for efficient querying and log analysis
ModerationLogSchema.index({ level: 1, category: 1, createdAt: -1 });
ModerationLogSchema.index({ performedBy: 1, createdAt: -1 });
ModerationLogSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
ModerationLogSchema.index({ isAutomated: 1, automationRule: 1 });
ModerationLogSchema.index({ tags: 1 });

// TTL index to automatically remove old logs after 1 year
ModerationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
