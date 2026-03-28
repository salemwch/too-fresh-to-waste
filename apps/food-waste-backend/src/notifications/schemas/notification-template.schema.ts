import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { NotificationType, NotificationTrigger } from '../types/notification.types';

@Schema({
  timestamps: true,
  collection: 'notification_templates',
})
export class NotificationTemplate extends Document {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, enum: NotificationTrigger })
  trigger!: NotificationTrigger;

  @Prop({ required: true, enum: NotificationType })
  type!: NotificationType;

  @Prop({ required: true })
  subject!: string; // For emails, title for push

  @Prop({ required: true })
  body!: string;

  @Prop()
  htmlBody?: string; // For email templates

  @Prop({ type: Object })
  variables?: Record<string, string>; // Template variables like {{userName}}, {{offerTitle}}

  @Prop({ type: Object })
  styling?: {
    backgroundColor?: string;
    textColor?: string;
    buttonColor?: string;
    logoUrl?: string;
  };

  @Prop({ type: Object })
  pushConfig?: {
    sound?: string;
    badge?: number;
    clickAction?: string;
    icon?: string;
    image?: string;
  };

  @Prop({ type: Object })
  emailConfig?: {
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
  };

  @Prop({ type: Object })
  smsConfig?: {
    senderId?: string;
    shortUrl?: boolean;
  };

  @Prop({ type: Map, of: Object })
  localization?: Map<
    string,
    {
      subject: string;
      body: string;
      htmlBody?: string;
    }
  >; // Language code -> localized content

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  version!: string;

  @Prop({ type: Object })
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
    createdBy?: string;
    lastModifiedBy?: string;
  };
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);

NotificationTemplateSchema.index({ trigger: 1, type: 1 });
NotificationTemplateSchema.index({ isActive: 1 });
