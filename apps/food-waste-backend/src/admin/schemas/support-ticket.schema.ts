import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  AWAITING_USER = 'awaiting_user',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketCategory {
  ORDER_ISSUE = 'order_issue',
  PAYMENT_DISPUTE = 'payment_dispute',
  ACCOUNT_PROBLEM = 'account_problem',
  ESTABLISHMENT_COMPLAINT = 'establishment_complaint',
  TECHNICAL_BUG = 'technical_bug',
  FEATURE_REQUEST = 'feature_request',
  OTHER = 'other',
}

export type SupportTicketDocument = SupportTicket & Document;

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  subject!: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  description!: string;

  @Prop({ type: String, enum: TicketCategory, required: true })
  category!: TicketCategory;

  @Prop({ type: String, enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @Prop({ type: String, enum: TicketStatus, default: TicketStatus.OPEN })
  status!: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  relatedOrderId?: Types.ObjectId;

  @Prop({
    type: [
      {
        authorId: { type: Types.ObjectId, ref: 'User' },
        authorRole: { type: String, enum: ['user', 'admin', 'system'] },
        message: { type: String, maxlength: 5000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  replies!: Array<{
    authorId: Types.ObjectId;
    authorRole: 'user' | 'admin' | 'system';
    message: string;
    createdAt: Date;
  }>;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: Date })
  firstResponseAt?: Date;

  @Prop({ type: String, maxlength: 500 })
  resolutionNote?: string;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ userId: 1, status: 1 });
SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ category: 1, status: 1 });
