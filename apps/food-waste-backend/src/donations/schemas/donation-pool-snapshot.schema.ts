import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { DonationGoalCategory } from '@foodwaste/shared';

export type DonationPoolSnapshotDocument = DonationPoolSnapshot & Document;

/**
 * Pre-aggregated category stats — one document per DonationGoalCategory.
 * Frontend reads all 5 rows in a single find(). On purchase the active
 * category row receives an O(1) $inc. Nightly cron refreshes `percent`.
 */
@Schema({ timestamps: true })
export class DonationPoolSnapshot {
  @Prop({ type: String, enum: DonationGoalCategory, required: true })
  category!: DonationGoalCategory;

  @Prop({ required: true, default: 0, min: 0 })
  totalAmount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalItems!: number;

  @Prop({ required: true, default: 0, min: 0, max: 100 })
  percent!: number;

  @Prop({ required: true, default: 300, min: 0 })
  targetAmount!: number;
}

export const DonationPoolSnapshotSchema = SchemaFactory.createForClass(DonationPoolSnapshot);

DonationPoolSnapshotSchema.index({ category: 1 }, { unique: true });
