import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PopularSearchDocument = PopularSearch & Document;

export enum PopularityPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class PopularSearch {
  @Prop({ required: true, trim: true, maxlength: 200 })
  query: string;

  @Prop({ required: true, type: String, enum: PopularityPeriod })
  period: PopularityPeriod;

  @Prop({ required: true, type: Date })
  periodStart: Date;

  @Prop({ required: true, type: Date })
  periodEnd: Date;

  @Prop({ type: Number, default: 1, min: 0 })
  searchCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  uniqueUsers: number;

  @Prop({ type: Number, default: 0, min: 0 })
  clickThroughs: number;

  @Prop({ type: Number, default: 0, min: 0, max: 1 })
  clickThroughRate: number;

  @Prop({ type: Number, default: 0, min: 0 })
  conversions: number;

  @Prop({ type: Number, default: 0, min: 0, max: 1 })
  conversionRate: number;

  @Prop({ type: Number, default: 0 })
  averageResponseTime: number;

  @Prop({ type: Object })
  demographics?: {
    ageGroups?: Record<string, number>;
    locations?: Record<string, number>;
    userTypes?: Record<string, number>; // consumer, merchant, etc.
  };

  @Prop({ type: [String], default: [] })
  relatedQueries: string[];

  @Prop({ type: [String], default: [] })
  commonFilters: string[]; // Most used filters with this query

  @Prop({ type: Number, default: 0 })
  trendScore: number; // Calculated trending score

  @Prop({ type: String, enum: ['rising', 'stable', 'declining'] })
  trendDirection?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PopularSearchSchema = SchemaFactory.createForClass(PopularSearch);

// Indexes for performance
PopularSearchSchema.index({ query: 'text' });
PopularSearchSchema.index({ query: 1, period: 1, periodStart: 1 });
PopularSearchSchema.index({ period: 1, searchCount: -1 });
PopularSearchSchema.index({ period: 1, trendScore: -1 });
PopularSearchSchema.index({ periodStart: -1, periodEnd: -1 });
PopularSearchSchema.index({ isActive: 1, period: 1, searchCount: -1 });
PopularSearchSchema.index({ createdAt: -1 });

// Compound index for efficient trending queries
PopularSearchSchema.index({
  period: 1,
  trendScore: -1,
  searchCount: -1,
  isActive: 1
});

// TTL index: auto-delete popular search records after 180 days to prevent unbounded collection growth
PopularSearchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000, name: 'idx_popularsearches_createdAt_ttl_180d' });