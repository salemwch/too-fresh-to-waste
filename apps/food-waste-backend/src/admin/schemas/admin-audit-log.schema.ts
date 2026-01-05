import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AdminAction, AuditLogValue } from '../interfaces/admin-analytics.interface';

export type AdminAuditLogDocument = AdminAuditLog & Document;

@Schema({ timestamps: true, collection: 'admin_audit_logs' })
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  adminId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  adminEmail: string;

  @Prop({ type: String, enum: AdminAction, required: true, index: true })
  action: AdminAction;

  @Prop({
    type: String,
    enum: ['user', 'establishment', 'order', 'review', 'offer', 'system'],
    required: true,
    index: true
  })
  targetType: string;

  @Prop({ type: String, index: true })
  targetId?: string;

  @Prop({ type: Object })
  previousValue?: Record<string, AuditLogValue>;

  @Prop({ type: Object })
  newValue?: Record<string, AuditLogValue>;

  @Prop({ trim: true, maxlength: 500 })
  reason?: string;

  @Prop({ required: true, index: true })
  ipAddress: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop({ type: Object })
  metadata?: Record<string, AuditLogValue>;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);

// Compound indexes for efficient querying
AdminAuditLogSchema.index({ adminId: 1, timestamp: -1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });
AdminAuditLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });

// TTL index for automatic cleanup (keep logs for 2 years)
AdminAuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });