import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationChannel } from '../types/notification.types';

export type NotificationPreferenceDocument = NotificationPreference & Document;

@Schema({
  timestamps: true,
  collection: 'notification_preferences'
})
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({
    type: Map,
    of: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    default: () => ({
      [NotificationChannel.ORDER_UPDATES]: { push: true, email: true, sms: false },
      [NotificationChannel.PICKUP_REMINDERS]: { push: true, email: true, sms: true },
      [NotificationChannel.OFFERS]: { push: true, email: false, sms: false },
      [NotificationChannel.MARKETING]: { push: false, email: true, sms: false },
      [NotificationChannel.SECURITY]: { push: true, email: true, sms: true },
      [NotificationChannel.ADMIN]: { push: true, email: true, sms: false }
    })
  })
  channels: Map<NotificationChannel, {
    push: boolean;
    email: boolean;
    sms: boolean;
  }>;

  @Prop({ default: true })
  globalPushEnabled: boolean;

  @Prop({ default: true })
  globalEmailEnabled: boolean;

  @Prop({ default: false })
  globalSmsEnabled: boolean;

  @Prop({ type: Object, default: {} })
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    timezone: string;
  };

  @Prop({ type: [String], default: [] })
  deviceTokens: string[];

  @Prop()
  language?: string;

  @Prop()
  timezone?: string;

  @Prop({ type: Object, default: {} })
  locationPreferences?: {
    radius: number; // km
    enableNearbyOffers: boolean;
    savedLocations: Array<{
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    }>;
  };
  // createdAt and updatedAt are managed by Mongoose `timestamps: true`
  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);

NotificationPreferenceSchema.index({ deviceTokens: 1 });