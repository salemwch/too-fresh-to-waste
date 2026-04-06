import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalyticsCacheDocument = AnalyticsCache & Document;

export interface CacheKey {
  endpoint: string;
  filters: Record<string, string | number | boolean | string[] | number[] | object>;
  aggregation?: Record<string, string | number | boolean | object>;
  version: string; // for cache invalidation when analytics logic changes
}

export interface CacheMetadata {
  generatedAt: Date;
  expiresAt: Date;
  dataSize: number;
  computationTimeMs: number;
  hitCount: number;
  lastAccessed: Date;
}

@Schema({
  timestamps: true,
  collection: 'analytics_cache',
})
export class AnalyticsCache {
  @Prop({
    type: Object,
    required: true,
  })
  key!: CacheKey;

  @Prop({
    type: String,
    required: true,
  })
  keyHash!: string; // MD5 hash of key for efficient indexing

  @Prop({
    type: Object,
    required: true,
  })
  data!: Record<string, unknown>;

  @Prop({
    type: Object,
    required: true,
  })
  metadata!: CacheMetadata;

  @Prop({
    type: String,
    enum: [
      'business',
      'user',
      'establishment',
      'offer',
      'order',
      'payment',
      'sustainability',
      'location',
    ],
    required: true,
  })
  category!: string;

  @Prop({
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  })
  expiresAt!: Date;

  @Prop({
    type: [String],
    default: [],
  })
  tags!: string[]; // for selective cache invalidation
}

export const AnalyticsCacheSchema = SchemaFactory.createForClass(AnalyticsCache);

// Indexes for optimal performance
AnalyticsCacheSchema.index({ keyHash: 1 }, { unique: true });
AnalyticsCacheSchema.index({ category: 1, expiresAt: 1 });
AnalyticsCacheSchema.index({ tags: 1 });
AnalyticsCacheSchema.index({ 'metadata.lastAccessed': 1 });
