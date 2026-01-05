import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OfferPerformanceDocument = OfferPerformance & Document;

@Schema({ timestamps: true })
export class OfferPerformance {
  @Prop({ type: Types.ObjectId, ref: 'Offer', required: true })
  offerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  merchantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({
    type: {
      views: { type: Number, default: 0 },
      favorites: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
    },
    default: {},
  })
  engagement: {
    views: number;
    favorites: number;
    shares: number;
    clicks: number;
    impressions: number;
  };

  @Prop({
    type: {
      totalQuantity: { type: Number, default: 0 },
      soldQuantity: { type: Number, default: 0 },
      reservedQuantity: { type: Number, default: 0 },
      availableQuantity: { type: Number, default: 0 },
      sellThroughRate: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  inventory: {
    totalQuantity: number;
    soldQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    sellThroughRate: number;
  };

  @Prop({
    type: {
      totalRevenue: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  sales: {
    totalRevenue: number;
    averageOrderValue: number;
    totalOrders: number;
    conversionRate: number;
  };

  @Prop({
    type: {
      originalPrice: { type: Number, default: 0 },
      discountedPrice: { type: Number, default: 0 },
      discountPercentage: { type: Number, default: 0 },
      priceCompetitiveness: { type: Number, default: 0 }, // score 0-100
    },
    default: {},
  })
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    priceCompetitiveness: number;
  };

  @Prop({
    type: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      positiveReviews: { type: Number, default: 0 },
      negativeReviews: { type: Number, default: 0 },
      satisfactionScore: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  customerFeedback: {
    averageRating: number;
    totalReviews: number;
    positiveReviews: number;
    negativeReviews: number;
    satisfactionScore: number;
  };

  @Prop({
    type: [{
      date: Date,
      views: Number,
      orders: Number,
      revenue: Number,
    }],
    default: [],
  })
  dailyBreakdown: Array<{
    date: Date;
    views: number;
    orders: number;
    revenue: number;
  }>;

  @Prop({
    type: [{
      hour: Number,
      views: Number,
      orders: Number,
    }],
    default: [],
  })
  peakHours: Array<{
    hour: number;
    views: number;
    orders: number;
  }>;

  @Prop({
    type: {
      totalTimeActive: { type: Number, default: 0 }, // minutes
      averageTimeToSellOut: { type: Number, default: 0 }, // minutes
      optimalListingTime: String, // e.g., "14:00"
      bestPerformingDays: [String], // e.g., ["Monday", "Friday"]
    },
    default: {},
  })
  timing: {
    totalTimeActive: number;
    averageTimeToSellOut: number;
    optimalListingTime: string;
    bestPerformingDays: string[];
  };

  @Prop({ default: Date.now })
  lastCalculated: Date;

  @Prop({ required: true })
  status: string; // 'active', 'sold_out', 'expired', 'cancelled'

  @Prop()
  createdAt: Date;

  @Prop()
  expiresAt: Date;
}

export const OfferPerformanceSchema = SchemaFactory.createForClass(OfferPerformance);

// Create indexes for efficient querying
OfferPerformanceSchema.index({ offerId: 1 }, { unique: true });
OfferPerformanceSchema.index({ merchantId: 1, createdAt: -1 });
OfferPerformanceSchema.index({ establishmentId: 1, 'sales.totalRevenue': -1 });
OfferPerformanceSchema.index({ categories: 1, 'sales.conversionRate': -1 });
OfferPerformanceSchema.index({ status: 1, lastCalculated: -1 });