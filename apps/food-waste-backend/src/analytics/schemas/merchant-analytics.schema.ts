import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantAnalyticsDocument = MerchantAnalytics & Document;

@Schema({ timestamps: true })
export class MerchantAnalytics {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  merchantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId: Types.ObjectId;

  @Prop({ required: true })
  period: string; // 'daily', 'weekly', 'monthly', 'yearly'

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({
    type: {
      totalOrders: { type: Number, default: 0 },
      completedOrders: { type: Number, default: 0 },
      cancelledOrders: { type: Number, default: 0 },
      expiredOrders: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  orderMetrics: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    expiredOrders: number;
    conversionRate: number;
  };

  @Prop({
    type: {
      totalOffers: { type: Number, default: 0 },
      activeOffers: { type: Number, default: 0 },
      soldOutOffers: { type: Number, default: 0 },
      expiredOffers: { type: Number, default: 0 },
      averageDiscountPercentage: { type: Number, default: 0 },
    },
    default: {},
  })
  offerMetrics: {
    totalOffers: number;
    activeOffers: number;
    soldOutOffers: number;
    expiredOffers: number;
    averageDiscountPercentage: number;
  };

  @Prop({
    type: {
      grossRevenue: { type: Number, default: 0 },
      netRevenue: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      revenueGrowth: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  revenueMetrics: {
    grossRevenue: number;
    netRevenue: number;
    averageOrderValue: number;
    revenueGrowth: number;
  };

  @Prop({
    type: {
      newCustomers: { type: Number, default: 0 },
      returningCustomers: { type: Number, default: 0 },
      customerRetentionRate: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    default: {},
  })
  customerMetrics: {
    newCustomers: number;
    returningCustomers: number;
    customerRetentionRate: number;
    averageRating: number;
    totalReviews: number;
  };

  @Prop({ type: [String], default: [] })
  topCategories: string[];

  @Prop({
    type: [{
      hour: Number,
      orders: Number,
      revenue: Number,
    }],
    default: [],
  })
  hourlyBreakdown: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;

  @Prop({ default: Date.now })
  calculatedAt: Date;
}

export const MerchantAnalyticsSchema = SchemaFactory.createForClass(MerchantAnalytics);

// Create indexes for efficient querying
MerchantAnalyticsSchema.index({ merchantId: 1, period: 1, periodStart: -1 });
MerchantAnalyticsSchema.index({ establishmentId: 1, period: 1 });
MerchantAnalyticsSchema.index({ periodStart: -1, periodEnd: -1 });