import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SearchSuggestionDocument = SearchSuggestion & Document;

export enum SuggestionType {
  QUERY = 'query',
  CATEGORY = 'category',
  ESTABLISHMENT = 'establishment',
  CUISINE = 'cuisine',
  DIETARY = 'dietary',
  LOCATION = 'location',
}

export enum SuggestionSource {
  USER_HISTORY = 'user_history',
  POPULAR_SEARCHES = 'popular_searches',
  AUTOCOMPLETE = 'autocomplete',
  TRENDING = 'trending',
  SEMANTIC = 'semantic',
  LOCATION_BASED = 'location_based',
}

@Schema({ timestamps: true })
export class SearchSuggestion {
  @Prop({ required: true, trim: true, maxlength: 200 })
  text: string;

  @Prop({ required: true, type: String, enum: SuggestionType })
  type: SuggestionType;

  @Prop({ required: true, type: String, enum: SuggestionSource })
  source: SuggestionSource;

  @Prop({ type: Number, default: 0, min: 0 })
  frequency: number;

  @Prop({ type: Number, default: 0, min: 0, max: 1 })
  relevanceScore: number;

  @Prop({ type: [String], default: [] })
  aliases: string[]; // Alternative terms that should trigger this suggestion

  @Prop({ type: [String], default: [] })
  relatedSuggestions: string[];

  @Prop({ type: Object })
  metadata?: {
    categoryId?: string;
    establishmentId?: string;
    location?: {
      coordinates: [number, number];
      name: string;
    };
    seasonal?: boolean;
    trending?: {
      score: number;
      period: string;
    };
  };

  @Prop({ type: Date })
  lastUsed?: Date;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  clickThroughRate: number;

  @Prop({ type: Number, default: 0 })
  conversionRate: number;

  @Prop({ type: Date })
  expiresAt?: Date; // For trending suggestions

  createdAt?: Date;
  updatedAt?: Date;
}

export const SearchSuggestionSchema = SchemaFactory.createForClass(SearchSuggestion);

// Indexes for performance
SearchSuggestionSchema.index({ text: 'text' });
SearchSuggestionSchema.index({ text: 1, type: 1 });
SearchSuggestionSchema.index({ type: 1, frequency: -1 });
SearchSuggestionSchema.index({ source: 1, relevanceScore: -1 });
SearchSuggestionSchema.index({ aliases: 1 });
SearchSuggestionSchema.index({ isActive: 1, frequency: -1 });
SearchSuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SearchSuggestionSchema.index({ createdAt: -1 });
SearchSuggestionSchema.index({ 'metadata.location.coordinates': '2dsphere' });