import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Interface for notification payload data
interface INotificationData {
    offerId?: string;
    orderId?: string;
    establishmentId?: string;
    userId?: string;
    url?: string;
    action?: string;
    category?: string;
    priority?: string;
    discount?: number;
    price?: number;
    originalPrice?: number;
    quantity?: number;
    pickupTime?: string;
    location?: {
        name: string;
        address: string;
        coordinates?: [number, number];
    };
    tracking?: {
        event: string;
        timestamp: string;
        status: string;
    };
    payment?: {
        amount: number;
        currency: string;
        method: string;
    };
    items?: Array<{
        name: string;
        quantity: number;
        price: number;
    }>;
    customFields?: Record<string, string | number | boolean>;
}
import { Document, Types } from 'mongoose';
import { NotificationType, NotificationChannel, NotificationStatus, NotificationPriority, NotificationTrigger } from '../types/notification.types';

@Schema({
  timestamps: true,
  collection: 'notifications'
})
export class Notification extends Document {
  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true, enum: NotificationChannel })
  channel: NotificationChannel;

  @Prop({ required: true, enum: NotificationTrigger })
  trigger: NotificationTrigger;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  establishmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Object })
  data?: INotificationData;

  @Prop()
  image?: string;

  @Prop({ required: true, enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Prop({ required: true, enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority: NotificationPriority;

  @Prop()
  scheduledAt?: Date;

  @Prop()
  sentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Object })
  metadata?: {
    deviceToken?: string;
    email?: string;
    phone?: string;
    segment?: string;
    campaign?: string;
    templateId?: string;
    retryCount?: number;
    maxRetries?: number;
  };

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false })
  isBulk: boolean;

  @Prop()
  expiresAt?: Date;
  @Prop()
  createdAt: Date;
  @Prop()
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ type: 1, channel: 1 });
NotificationSchema.index({ trigger: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });