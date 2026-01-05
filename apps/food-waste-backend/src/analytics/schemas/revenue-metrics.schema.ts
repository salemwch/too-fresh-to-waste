import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RevenueMetricsDocument = RevenueMetrics & Document;

@Schema({ timestamps: true })
export class RevenueMetrics {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  merchantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  period: string; // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

  @Prop({
    type: {
      total: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      fees: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
      currency: { type: String, default: 'EUR' },
    },
    required: true,
  })
  revenue: {
    total: number;
    orders: number;
    fees: number;
    taxes: number;
    net: number;
    currency: string;
  };

  @Prop({
    type: {
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      highestOrderValue: { type: Number, default: 0 },
      lowestOrderValue: { type: Number, default: 0 },
    },
    default: {},
  })
  orders: {
    totalOrders: number;
    averageOrderValue: number;
    highestOrderValue: number;
    lowestOrderValue: number;
  };

  @Prop({
    type: {
      newCustomers: { type: Number, default: 0 },
      returningCustomers: { type: Number, default: 0 },
      totalUniqueCustomers: { type: Number, default: 0 },
      customerAcquisitionCost: { type: Number, default: 0 },
      customerLifetimeValue: { type: Number, default: 0 },
    },
    default: {},
  })
  customers: {
    newCustomers: number;
    returningCustomers: number;
    totalUniqueCustomers: number;
    customerAcquisitionCost: number;
    customerLifetimeValue: number;
  };

  @Prop({
    type: {
      totalOffers: { type: Number, default: 0 },
      soldOutOffers: { type: Number, default: 0 },
      expiredOffers: { type: Number, default: 0 },
      averageDiscountPercentage: { type: Number, default: 0 },
      mostPopularCategory: String,
    },
    default: {},
  })
  offers: {
    totalOffers: number;
    soldOutOffers: number;
    expiredOffers: number;
    averageDiscountPercentage: number;
    mostPopularCategory: string;
  };

  @Prop({
    type: [{
      category: String,
      revenue: Number,
      orders: Number,
      percentage: Number,
    }],
    default: [],
  })
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    orders: number;
    percentage: number;
  }>;

  @Prop({
    type: [{
      hour: Number,
      revenue: Number,
      orders: Number,
    }],
    default: [],
  })
  hourlyBreakdown: Array<{
    hour: number;
    revenue: number;
    orders: number;
  }>;

  @Prop({
    type: [{
      date: Date,
      revenue: Number,
      orders: Number,
      customers: Number,
    }],
    default: [],
  })
  dailyBreakdown: Array<{
    date: Date;
    revenue: number;
    orders: number;
    customers: number;
  }>;

  @Prop({
    type: {
      previousPeriodRevenue: { type: Number, default: 0 },
      revenueGrowthRate: { type: Number, default: 0 }, // percentage
      previousPeriodOrders: { type: Number, default: 0 },
      orderGrowthRate: { type: Number, default: 0 }, // percentage
      marketShare: { type: Number, default: 0 }, // percentage within platform
    },
    default: {},
  })
  growth: {
    previousPeriodRevenue: number;
    revenueGrowthRate: number;
    previousPeriodOrders: number;
    orderGrowthRate: number;
    marketShare: number;
  };

  @Prop({
    type: {
      peakRevenueHour: Number,
      peakOrdersDay: String,
      averageOrderProcessingTime: Number, // minutes
      customerSatisfactionScore: Number, // 0-100
      repeatCustomerRate: Number, // percentage
    },
    default: {},
  })
  insights: {
    peakRevenueHour: number;
    peakOrdersDay: string;
    averageOrderProcessingTime: number;
    customerSatisfactionScore: number;
    repeatCustomerRate: number;
  };

  @Prop({
    type: {
      nextPeriodForecast: { type: Number, default: 0 },
      confidenceLevel: { type: Number, default: 0 }, // percentage
      trendDirection: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
      seasonalityFactor: { type: Number, default: 1 }, // multiplier
    },
    default: {},
  })
  forecast: {
    nextPeriodForecast: number;
    confidenceLevel: number;
    trendDirection: 'up' | 'down' | 'stable';
    seasonalityFactor: number;
  };

  @Prop({ default: Date.now })
  calculatedAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const RevenueMetricsSchema = SchemaFactory.createForClass(RevenueMetrics);

// Create compound indexes for efficient querying
RevenueMetricsSchema.index({ merchantId: 1, date: -1 });
RevenueMetricsSchema.index({ establishmentId: 1, period: 1, date: -1 });
RevenueMetricsSchema.index({ period: 1, date: -1 });
RevenueMetricsSchema.index({ 'revenue.total': -1, date: -1 });
RevenueMetricsSchema.index({ merchantId: 1, period: 1, date: -1 }, { unique: true });