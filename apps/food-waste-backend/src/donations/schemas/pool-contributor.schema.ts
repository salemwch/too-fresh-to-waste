import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PoolContributorDocument = PoolContributor & Document;

/**
 * PoolContributor — one document per (poolId, userId) pair.
 *
 * The unique compound index is the sole enforcer of contributor uniqueness.
 * Inserting succeeds for a new contributor and throws error code 11000 for a
 * returning one — no scan, no count, no race condition.
 */
@Schema({ timestamps: false })
export class PoolContributor {
  @Prop({ required: true, type: Types.ObjectId, ref: 'DonationPool', index: false })
  poolId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: false })
  userId!: Types.ObjectId;
}

export const PoolContributorSchema = SchemaFactory.createForClass(PoolContributor);

// The unique constraint is the entire point of this collection.
PoolContributorSchema.index({ poolId: 1, userId: 1 }, { unique: true });
