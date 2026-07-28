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
  notifications!: boolean;

  @Prop({ default: true })
  emailAlerts!: boolean;

  @Prop({ default: true })
  pushNotifications!: boolean;

  @Prop({ type: [String], default: [] })
  preferredTimes!: string[]; // ['morning', 'afternoon', 'evening']

  @Prop({ type: [Number], default: [] })
  preferredDays!: number[]; // [1,2,3,4,5] for weekdays

  @Prop({ type: Number, min: 0, max: 50, default: 5 })
  maxDistance!: number; // in kilometers
}

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: FavoriteType })
  type!: FavoriteType;

  @Prop({ required: true, type: Types.ObjectId })
  itemId!: Types.ObjectId;

  @Prop()
  itemName?: string;

  @Prop()
  itemImage?: string;

  @Prop({ type: FavoritePreference, default: () => ({}) })
  preferences!: FavoritePreference;

  @Prop({ default: Date.now })
  addedAt!: Date;

  @Prop()
  lastNotified?: Date;

  @Prop({ default: 0 })
  notificationCount!: number;

  @Prop({ default: 0 })
  interactionCount!: number;

  @Prop()
  lastInteraction?: Date;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop([String])
  tags?: string[];

  @Prop()
  notes?: string;

  @Prop({ type: Map, of: String })
  metadata?: Map<string, string>;
}

export type FavoriteDocument = Favorite & Document;
export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// ============================================================================
// Indexes for Performance Optimization
// ============================================================================

// Compound index to ensure one favorite per user per item (UNIQUE CONSTRAINT)
FavoriteSchema.index({ userId: 1, type: 1, itemId: 1 }, { unique: true });

// Query optimization: getUserFavoriteOfferIds (for isFavorite computation)
// Covers query: { userId, type: 'offer', isActive: true }
FavoriteSchema.index({ userId: 1, type: 1, isActive: 1 }, { name: 'user_favorites_lookup' });

// Query optimization: favorites list pagination
// Covers query: { userId, isActive, addedAt } with sorting
FavoriteSchema.index({ userId: 1, isActive: 1, addedAt: -1 }, { name: 'user_favorites_list' });

// Legacy indexes (keep for backward compatibility)
FavoriteSchema.index({ lastInteraction: -1 });

/**
 * Indexes below were declared only in the former ALL_INDEXES constant, never on
 * this schema. Because `autoIndex` is off in production, that constant was what
 * production actually had, so these are live indexes. Names kept verbatim — the
 * same key pattern cannot exist under two names.
 *
 * Not ported: `{ userId, isActive, type, addedAt }`. The existing
 * `user_favorites_list` ({ userId, isActive, addedAt }) and
 * `user_favorites_lookup` ({ userId, type, isActive }) already serve those
 * shapes; a fourth permutation would add write cost for no new query.
 */

/** Reverse lookup: who favourited this item (recommendations, popularity). */
FavoriteSchema.index({ itemId: 1, isActive: 1 }, { name: 'idx_favorites_itemId_isActive' });

/** A single user's most recent interactions — userId leads so the scan is bounded. */
FavoriteSchema.index(
  { userId: 1, lastInteraction: -1 },
  { name: 'idx_favorites_userId_lastInteraction' },
);

/** Tag filtering within a user's favourites. */
FavoriteSchema.index({ tags: 1, userId: 1 }, { name: 'idx_favorites_tags_userId' });
