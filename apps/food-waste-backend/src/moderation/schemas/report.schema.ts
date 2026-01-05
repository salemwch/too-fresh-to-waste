import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

export enum ReportType {
    USER = 'user',
    ESTABLISHMENT = 'establishment',
    OFFER = 'offer',
    ORDER = 'order',
    REVIEW = 'review',
}

export enum ReportReason {
    SPAM = 'spam',
    HARASSMENT = 'harassment',
    INAPPROPRIATE_CONTENT = 'inappropriate_content',
    FRAUD = 'fraud',
    FAKE_PROFILE = 'fake_profile',
    VIOLATION_OF_TERMS = 'violation_of_terms',
    HEALTH_SAFETY = 'health_safety',
    COPYRIGHT = 'copyright',
    OTHER = 'other',
}

export enum ReportStatus {
    PENDING = 'pending',
    IN_REVIEW = 'in_review',
    RESOLVED = 'resolved',
    REJECTED = 'rejected',
    ESCALATED = 'escalated',
}

export enum ReportPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

@Schema({ timestamps: true })
export class Report {
    @Prop({ type: String, enum: ReportType, required: true, index: true })
    type: ReportType;

    @Prop({ type: Types.ObjectId, required: true, index: true })
    targetId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    reporterId: Types.ObjectId;

    @Prop({ type: String, enum: ReportReason, required: true, index: true })
    reason: ReportReason;

    @Prop({ required: true, maxlength: 1000 })
    description: string;

    @Prop({ type: [String], default: [] })
    evidence: string[];

    @Prop({ type: String, enum: ReportStatus, default: ReportStatus.PENDING, index: true })
    status: ReportStatus;

    @Prop({ type: String, enum: ReportPriority, default: ReportPriority.MEDIUM, index: true })
    priority: ReportPriority;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true })
    assignedToModerator?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    resolvedBy?: Types.ObjectId;

    @Prop()
    resolvedAt?: Date;

    @Prop({ maxlength: 1000 })
    resolutionNotes?: string;

    @Prop({
        type: [{
            action: { type: String, enum: ['comment', 'status_change', 'priority_change', 'assignment'] },
            performedBy: { type: Types.ObjectId, ref: 'User' },
            details: String,
            timestamp: { type: Date, default: Date.now }
        }],
        default: []
    })
    moderationHistory: Array<{
        action: string;
        performedBy: Types.ObjectId;
        details?: string;
        timestamp: Date;
    }>;

    @Prop({ default: false })
    isAutoFlagged: boolean;

    @Prop()
    autoFlaggedReason?: string;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Compound indexes for efficient querying
ReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
ReportSchema.index({ assignedToModerator: 1, status: 1 });
ReportSchema.index({ targetId: 1, type: 1 });
ReportSchema.index({ reporterId: 1, createdAt: -1 });