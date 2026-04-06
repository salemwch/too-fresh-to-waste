import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertRuleDocument = AlertRule & Document;
export type AlertDocument = Alert & Document;

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'sms' | 'slack';
  config: {
    emails?: string[];
    webhookUrl?: string;
    phoneNumbers?: string[];
    slackChannel?: string;
    slackWebhook?: string;
  };
}

export interface AlertCondition {
  field: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'percent_change' | 'threshold_breach';
  value: number;
  timeWindow: number; // in minutes
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

@Schema({
  timestamps: true,
  collection: 'alert_rules',
})
export class AlertRule {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    maxlength: 500,
  })
  description!: string;

  @Prop({
    type: String,
    required: true,
  })
  metric!: string;

  @Prop({
    type: {
      field: { type: String, required: true },
      operator: {
        type: String,
        enum: ['greater_than', 'less_than', 'equals', 'percent_change', 'threshold_breach'],
        required: true,
      },
      value: { type: Number, required: true },
      timeWindow: { type: Number, required: true, min: 1, max: 1440 },
      aggregation: {
        type: String,
        enum: ['sum', 'avg', 'min', 'max', 'count'],
        default: 'avg',
      },
    },
    required: true,
  })
  condition!: AlertCondition;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'medium',
  })
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @Prop({
    type: [
      {
        type: {
          type: String,
          enum: ['email', 'webhook', 'sms', 'slack'],
          required: true,
        },
        config: {
          emails: [String],
          webhookUrl: String,
          phoneNumbers: [String],
          slackChannel: String,
          slackWebhook: String,
        },
      },
    ],
    required: true,
    validate: {
      validator(channels: NotificationChannel[]) {
        return channels.length > 0;
      },
      message: 'At least one notification channel is required',
    },
  })
  notificationChannels!: NotificationChannel[];

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: Object,
    default: {},
  })
  filters!: Record<string, string | number | boolean | string[] | number[]>; // Additional filters for the alert

  @Prop({
    type: Number,
    default: 0,
    min: 0,
    max: 60,
  })
  cooldownMinutes!: number; // Prevent alert spam

  @Prop({
    type: Date,
  })
  lastTriggered?: Date;

  @Prop({
    type: Date,
  })
  lastEvaluated?: Date;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  triggerCount!: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy!: Types.ObjectId;

  @Prop({
    type: [String],
    default: [],
  })
  tags!: string[];

  @Prop({
    type: Object,
    default: {},
  })
  metadata!: Record<string, string | number | boolean | Date>;
}

@Schema({
  timestamps: true,
  collection: 'alerts',
})
export class Alert {
  @Prop({
    type: Types.ObjectId,
    ref: 'AlertRule',
    required: true,
  })
  ruleId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  ruleName!: string;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  })
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @Prop({
    type: String,
    required: true,
    maxlength: 1000,
  })
  message!: string;

  @Prop({
    type: Number,
    required: true,
  })
  currentValue!: number;

  @Prop({
    type: Number,
    required: true,
  })
  threshold!: number;

  @Prop({
    type: Date,
    required: true,
  })
  triggeredAt!: Date;

  @Prop({
    type: Date,
  })
  acknowledgedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  acknowledgedBy?: Types.ObjectId;

  @Prop({
    type: Date,
  })
  resolvedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  resolvedBy?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['triggered', 'acknowledged', 'resolved', 'expired'],
    required: true,
    default: 'triggered',
  })
  status!: 'triggered' | 'acknowledged' | 'resolved' | 'expired';

  @Prop({
    type: Object,
    default: {},
  })
  metadata!: Record<string, string | number | boolean | Date>;

  @Prop({
    type: [
      {
        channel: String,
        sentAt: Date,
        success: Boolean,
        error: String,
      },
    ],
    default: [],
  })
  notifications!: Array<{
    channel: string;
    sentAt: Date;
    success: boolean;
    error?: string;
  }>;

  @Prop({
    type: String,
    maxlength: 1000,
  })
  resolutionNotes?: string;

  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from creation
    index: { expireAfterSeconds: 0 },
  })
  expiresAt!: Date;
}

export const AlertRuleSchema = SchemaFactory.createForClass(AlertRule);
export const AlertSchema = SchemaFactory.createForClass(Alert);

// AlertRule Indexes
AlertRuleSchema.index({ metric: 1, isActive: 1 });
AlertRuleSchema.index({ severity: 1, isActive: 1 });
AlertRuleSchema.index({ tags: 1 });

// Alert Indexes
AlertSchema.index({ ruleId: 1, status: 1 });
AlertSchema.index({ severity: 1, status: 1 });
AlertSchema.index({ status: 1, expiresAt: 1 });

// Middleware
AlertRuleSchema.pre('save', function () {
  if (this.isModified('condition') || this.isModified('filters')) {
    delete (this as { lastEvaluated?: Date }).lastEvaluated; // Force re-evaluation
  }
});

AlertSchema.pre('save', function () {
  // Auto-resolve expired alerts
  if (
    this.expiresAt !== null &&
    this.expiresAt !== undefined &&
    this.expiresAt < new Date() &&
    this.status === 'triggered'
  ) {
    this.status = 'expired';
  }
});
