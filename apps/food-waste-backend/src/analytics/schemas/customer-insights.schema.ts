import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerInsightsDocument = CustomerInsights & Document;

@Schema({ timestamps: true })
export class CustomerInsights {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  merchantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
  establishmentId: Types.ObjectId;

  @Prop({ required: true })
  period: string; // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({
    type: {
      total: { type: Number, default: 0 },
      new: { type: Number, default: 0 },
      returning: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      churned: { type: Number, default: 0 },
    },
    default: {},
  })
  customerCounts: {
    total: number;
    new: number;
    returning: number;
    active: number;
    churned: number;
  };

  @Prop({
    type: {
      newCustomerRate: { type: Number, default: 0 }, // percentage
      retentionRate: { type: Number, default: 0 }, // percentage
      churnRate: { type: Number, default: 0 }, // percentage
      repeatPurchaseRate: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  retentionMetrics: {
    newCustomerRate: number;
    retentionRate: number;
    churnRate: number;
    repeatPurchaseRate: number;
  };

  @Prop({
    type: {
      averageOrderValue: { type: Number, default: 0 },
      averageOrderFrequency: { type: Number, default: 0 }, // orders per month
      averageCustomerLifespan: { type: Number, default: 0 }, // months
      customerLifetimeValue: { type: Number, default: 0 },
    },
    default: {},
  })
  valueMetrics: {
    averageOrderValue: number;
    averageOrderFrequency: number;
    averageCustomerLifespan: number;
    customerLifetimeValue: number;
  };

  @Prop({
    type: [{
      ageGroup: String, // '18-25', '26-35', '36-45', '46-55', '55+'
      count: Number,
      percentage: Number,
      averageOrderValue: Number,
    }],
    default: [],
  })
  demographicBreakdown: Array<{
    ageGroup: string;
    count: number;
    percentage: number;
    averageOrderValue: number;
  }>;

  @Prop({
    type: [{
      location: String, // city or region
      customerCount: Number,
      percentage: Number,
      averageOrderValue: Number,
    }],
    default: [],
  })
  geographicDistribution: Array<{
    location: string;
    customerCount: number;
    percentage: number;
    averageOrderValue: number;
  }>;

  @Prop({
    type: [{
      segment: String, // 'high_value', 'frequent_buyer', 'occasional', 'at_risk', 'dormant'
      customerCount: Number,
      percentage: Number,
      averageOrderValue: Number,
      totalRevenue: Number,
    }],
    default: [],
  })
  customerSegments: Array<{
    segment: string;
    customerCount: number;
    percentage: number;
    averageOrderValue: number;
    totalRevenue: number;
  }>;

  @Prop({
    type: [{
      category: String,
      customerCount: Number,
      averageOrderValue: Number,
      totalRevenue: Number,
    }],
    default: [],
  })
  categoryPreferences: Array<{
    category: string;
    customerCount: number;
    averageOrderValue: number;
    totalRevenue: number;
  }>;

  @Prop({
    type: [{
      hour: Number,
      activeCustomers: Number,
      orderCount: Number,
    }],
    default: [],
  })
  behaviorPatterns: Array<{
    hour: number;
    activeCustomers: number;
    orderCount: number;
  }>;

  @Prop({
    type: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      positiveReviews: { type: Number, default: 0 },
      negativeReviews: { type: Number, default: 0 },
      nps: { type: Number, default: 0 }, // Net Promoter Score
    },
    default: {},
  })
  satisfactionMetrics: {
    averageRating: number;
    totalReviews: number;
    positiveReviews: number;
    negativeReviews: number;
    nps: number;
  };

  @Prop({
    type: [{
      customerId: { type: Types.ObjectId, ref: 'User' },
      totalOrders: Number,
      totalSpent: Number,
      averageOrderValue: Number,
      lastOrderDate: Date,
      customerSegment: String,
    }],
    default: [],
  })
  topCustomers: Array<{
    customerId: Types.ObjectId;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: Date;
    customerSegment: string;
  }>;

  @Prop({
    type: {
      mostActiveDay: String, // 'Monday', 'Tuesday', etc.
      mostActiveHour: Number,
      averageTimeBetweenOrders: Number, // days
      preferredPaymentMethod: String,
      averageDiscountSensitivity: Number, // percentage
    },
    default: {},
  })
  insights: {
    mostActiveDay: string;
    mostActiveHour: number;
    averageTimeBetweenOrders: number;
    preferredPaymentMethod: string;
    averageDiscountSensitivity: number;
  };

  @Prop({
    type: {
      predictedNewCustomers: { type: Number, default: 0 },
      predictedChurnRate: { type: Number, default: 0 },
      predictedLifetimeValue: { type: Number, default: 0 },
      confidenceLevel: { type: Number, default: 0 }, // percentage
    },
    default: {},
  })
  predictions: {
    predictedNewCustomers: number;
    predictedChurnRate: number;
    predictedLifetimeValue: number;
    confidenceLevel: number;
  };

  @Prop({ default: Date.now })
  calculatedAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const CustomerInsightsSchema = SchemaFactory.createForClass(CustomerInsights);

// Create indexes for efficient querying
CustomerInsightsSchema.index({ merchantId: 1, period: 1, periodStart: -1 });
CustomerInsightsSchema.index({ establishmentId: 1, period: 1 });
CustomerInsightsSchema.index({ periodStart: -1, periodEnd: -1 });
CustomerInsightsSchema.index({ 'customerCounts.total': -1, calculatedAt: -1 });