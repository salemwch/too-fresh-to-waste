import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ListVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  SHARED = 'shared',
}

@Schema({ _id: false })
export class ListItem {
  @Prop({ required: true, type: Types.ObjectId, refPath: 'type' })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  type!: string; // 'establishment' or 'offer'

  @Prop()
  addedAt!: Date;

  @Prop({ type: String })
  notes?: string | undefined;

  @Prop({ default: 0 })
  position!: number;
}

@Schema({ timestamps: true })
export class FavoriteList {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ enum: ListVisibility, default: ListVisibility.PRIVATE })
  visibility!: ListVisibility;

  @Prop([ListItem])
  items!: ListItem[];

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  sharedWith?: Types.ObjectId[];

  @Prop()
  iconEmoji?: string;

  @Prop()
  coverImage?: string;

  @Prop([String])
  tags!: string[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  viewCount!: number;

  @Prop({ default: 0 })
  shareCount!: number;

  @Prop()
  lastAccessedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastAccessedBy?: Types.ObjectId;
}

export type FavoriteListDocument = FavoriteList & Document;
export const FavoriteListSchema = SchemaFactory.createForClass(FavoriteList);

FavoriteListSchema.index({ userId: 1, name: 1 }, { unique: true });
FavoriteListSchema.index({ userId: 1, isActive: 1 });
FavoriteListSchema.index({ visibility: 1 });
FavoriteListSchema.index({ tags: 1 });
FavoriteListSchema.index({ createdAt: -1 });

/**
 * Indexes below were declared only in the former ALL_INDEXES constant, never on
 * this schema. Because `autoIndex` is off in production, that constant was what
 * production actually had, so these are live indexes. Names kept verbatim — the
 * same key pattern cannot exist under two names.
 *
 * Each is a superset of a shorter index declared above ({ userId, isActive } and
 * { visibility }). The shorter ones are now prefix-redundant and are candidates
 * for removal, but only against real usage data — run `pnpm db:audit-indexes`,
 * which checks $indexStats before suggesting a drop.
 */

/** A user's lists, newest first. */
FavoriteListSchema.index(
  { userId: 1, isActive: 1, createdAt: -1 },
  { name: 'idx_favoritelists_userId_isActive_createdAt' },
);

/** Lists shared with a given user. */
FavoriteListSchema.index(
  { sharedWith: 1, visibility: 1 },
  { name: 'idx_favoritelists_sharedWith_visibility' },
);

/** Public lists, most viewed first. */
FavoriteListSchema.index(
  { visibility: 1, viewCount: -1 },
  { name: 'idx_favoritelists_visibility_viewCount' },
);
