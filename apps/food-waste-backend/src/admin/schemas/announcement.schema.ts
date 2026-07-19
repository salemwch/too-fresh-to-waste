import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AnnouncementType {
  BANNER = 'banner',
  MAINTENANCE = 'maintenance',
  PROMOTION = 'promotion',
  UPDATE = 'update',
  ALERT = 'alert',
}

export enum AnnouncementTarget {
  ALL = 'all',
  CONSUMERS = 'consumers',
  MERCHANTS = 'merchants',
  SPECIFIC_ZONE = 'specific_zone',
}

export enum AnnouncementStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  ARCHIVED = 'archived',
}

export type AnnouncementDocument = Announcement & Document;

@Schema({ timestamps: true, collection: 'announcements' })
export class Announcement {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  content!: string;

  @Prop({ type: String, enum: AnnouncementType, required: true })
  type!: AnnouncementType;

  @Prop({ type: String, enum: AnnouncementTarget, default: AnnouncementTarget.ALL })
  target!: AnnouncementTarget;

  @Prop({ type: String, enum: AnnouncementStatus, default: AnnouncementStatus.DRAFT })
  status!: AnnouncementStatus;

  @Prop({ type: Date })
  startsAt?: Date;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  dismissible!: boolean;

  @Prop({ type: String })
  actionUrl?: string;

  @Prop({ type: String })
  actionLabel?: string;

  @Prop({ type: String })
  zoneId?: string;

  @Prop({ type: Number, default: 0 })
  priority!: number;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

AnnouncementSchema.index({ status: 1, startsAt: 1, expiresAt: 1 });
AnnouncementSchema.index({ target: 1, status: 1 });
