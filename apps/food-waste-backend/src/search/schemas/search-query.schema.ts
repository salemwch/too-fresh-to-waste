import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SearchQueryDocument = SearchQuery & Document;

export interface SearchFilters {
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  discountRange?: {
    min: number;
    max: number;
  };
  location?: {
    coordinates: [number, number]; // [lng, lat]
    radius: number; // in meters
  };
  dietaryRestrictions?: string[];
  establishmentTypes?: string[];
  pickupTimeSlots?: {
    startTime: string;
    endTime: string;
  }[];
  sortBy?: 'relevance' | 'price' | 'discount' | 'distance' | 'rating' | 'expiration';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  type: 'offer' | 'establishment' | 'category';
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  relevanceScore: number;
  distance?: number;
  metadata?: Record<string, any>;
}

@Schema({ timestamps: true })
export class SearchQuery {
  @Prop({ required: true, trim: true, maxlength: 500 })
  query: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String })
  sessionId: string;

  @Prop({ type: Object })
  filters: SearchFilters;

  @Prop({ type: [Object] })
  results: SearchResult[];

  @Prop({ type: Number, default: 0 })
  resultCount: number;

  @Prop({ type: Number })
  responseTime: number; // in milliseconds

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: Object })
  location?: {
    coordinates: [number, number];
    accuracy?: number;
    source?: 'gps' | 'ip' | 'manual';
  };

  @Prop({ type: Boolean, default: false })
  clickedResult: boolean;

  @Prop({ type: String })
  clickedResultId?: string;

  @Prop({ type: Number })
  clickedResultPosition?: number;

  @Prop({ type: Date })
  clickedAt?: Date;

  @Prop({ type: Boolean, default: false })
  correctedQuery: boolean;

  @Prop({ type: String })
  originalQuery?: string;

  @Prop({ type: [String], default: [] })
  suggestions: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const SearchQuerySchema = SchemaFactory.createForClass(SearchQuery);

// Indexes for performance
SearchQuerySchema.index({ query: 'text' });
SearchQuerySchema.index({ userId: 1, createdAt: -1 });
SearchQuerySchema.index({ sessionId: 1, createdAt: -1 });
SearchQuerySchema.index({ createdAt: -1 });
SearchQuerySchema.index({ 'location.coordinates': '2dsphere' });

// TTL index: auto-delete search queries after 90 days to prevent unbounded collection growth
SearchQuerySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000, name: 'idx_searchqueries_createdAt_ttl_90d' });