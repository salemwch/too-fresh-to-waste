import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum FavoriteType {
  ESTABLISHMENT = 'establishment',
  OFFER = 'offer',
  CATEGORY = 'category',
}

@Schema({ _id: false })
export class FavoritePreference {
  @Prop({ default: true })
  notifications: boolean;

  @Prop({ default: true })
  emailAlerts: boolean;

  @Prop({ default: true })
  pushNotifications: boolean;

  @Prop({ type: [String], default: [] })
  preferredTimes: string[]; // ['morning', 'afternoon', 'evening']

  @Prop({ type: [Number], default: [] })
  preferredDays: number[]; // [1,2,3,4,5] for weekdays

  @Prop({ type: Number, min: 0, max: 50, default: 5 })
  maxDistance: number; // in kilometers
}

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: FavoriteType })
  type: FavoriteType;

  @Prop({ required: true, type: Types.ObjectId, refPath: 'type' })
  itemId: Types.ObjectId;

  @Prop()
  itemName?: string;

  @Prop()
  itemImage?: string;

  @Prop({ type: FavoritePreference, default: () => ({}) })
  preferences: FavoritePreference;

  @Prop({ default: Date.now })
  addedAt: Date;

  @Prop()
  lastNotified?: Date;

  @Prop({ default: 0 })
  notificationCount: number;

  @Prop({ default: 0 })
  interactionCount: number;

  @Prop()
  lastInteraction?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop([String])
  tags?: string[];

  @Prop()
  notes?: string;

  @Prop({ type: Map, of: String })
  metadata?: Map<string, string>;
}

export type FavoriteDocument = Favorite & Document;
export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Compound index to ensure one favorite per user per item
FavoriteSchema.index({ userId: 1, type: 1, itemId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, isActive: 1 });
FavoriteSchema.index({ userId: 1, type: 1 });
FavoriteSchema.index({ addedAt: -1 });
FavoriteSchema.index({ lastInteraction: -1 });