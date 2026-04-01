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
