export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface DateGranularity {
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  timezone?: string;
}

export interface MetricValue {
  value: number;
  previousValue?: number;
  changePercentage?: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TimeSeries {
  timestamp: Date;
  value: number;
  label?: string;
}

// ==================== Business Analytics Interfaces ====================

export interface BusinessMetrics {
  totalRevenue: MetricValue;
  totalEarnings: MetricValue;
  totalOrders: MetricValue;
  averageOrderValue: MetricValue;
  conversionRate: MetricValue;
  customerAcquisitionCost: MetricValue;
  customerLifetimeValue: MetricValue;
  foodWasteSaved: MetricValue; // in kg
  carbonFootprintReduced: MetricValue; // in kg CO2
  waterSaved: MetricValue; // in liters
  packagingSaved: MetricValue; // in kg
  energySaved: MetricValue; // in kWh
}

export interface UserAnalytics {
  totalUsers: MetricValue;
  activeUsers: MetricValue;
  newUsers: MetricValue;
  retentionRate: MetricValue;
  churnRate: MetricValue;
  usersByRole: Record<string, number>;
  usersByLocation: Array<{
    city: string;
    country: string;
    count: number;
    coordinates?: [number, number];
  }>;
  userGrowthSeries: TimeSeries[];
}

export interface EstablishmentAnalytics {
  totalEstablishments: MetricValue;
  activeEstablishments: MetricValue;
  newEstablishments: MetricValue;
  establishmentsByType: Record<string, number>;
  establishmentsByStatus: Record<string, number>;
  topPerformingEstablishments: Array<{
    id: string;
    name: string;
    totalRevenue: number;
    totalOrders: number;
    averageRating: number;
    offerCount: number;
  }>;
  establishmentGrowthSeries: TimeSeries[];
}

export interface OfferAnalytics {
  totalOffers: MetricValue;
  activeOffers: MetricValue;
  soldOutOffers: MetricValue;
  expiredOffers: MetricValue;
  averageDiscountPercentage: MetricValue;
  offersByCategory: Record<string, number>;
  offersByType: Record<string, number>;
  topPerformingOffers: Array<{
    id: string;
    title: string;
    establishmentName: string;
    totalSold: number;
    revenue: number;
    averageRating?: number;
  }>;
  offerPerformanceSeries: TimeSeries[];
}

export interface OrderAnalytics {
  totalOrders: MetricValue;
  completedOrders: MetricValue;
  cancelledOrders: MetricValue;
  pendingOrders: MetricValue;
  averageOrderValue: MetricValue;
  ordersByStatus: Record<string, number>;
  ordersByTimeSlot: Record<string, number>;
  orderCompletionRate: MetricValue;
  orderCancellationRate: MetricValue;
  orderTrendSeries: TimeSeries[];
  revenueTimeSeries: TimeSeries[];
}

export interface PaymentAnalytics {
  totalPayments: MetricValue;
  successfulPayments: MetricValue;
  failedPayments: MetricValue;
  refundedPayments: MetricValue;
  totalRevenue: MetricValue;
  averageTransactionValue: MetricValue;
  paymentMethodDistribution: Record<string, number>;
  paymentSuccessRate: MetricValue;
  refundRate: MetricValue;
  revenueByCurrency: Record<string, number>;
}

export interface SustainabilityAnalytics {
  totalFoodSaved: MetricValue; // in kg
  totalMealsSaved: MetricValue;
  carbonFootprintReduced: MetricValue; // in kg CO2
  waterSaved: MetricValue; // in liters
  wasteDiversionRate: MetricValue; // percentage
  impactByCategory: Record<
    string,
    {
      foodSaved: number;
      carbonReduced: number;
      waterSaved: number;
    }
  >;
  impactTimeSeries: TimeSeries[];
  establishmentImpactRanking: Array<{
    establishmentId: string;
    name: string;
    foodSaved: number;
    carbonReduced: number;
    impactScore: number;
  }>;
}

export interface LocationAnalytics {
  ordersByLocation: Array<{
    city: string;
    country: string;
    orderCount: number;
    revenue: number;
    coordinates: [number, number];
  }>;
  popularAreas: Array<{
    center: [number, number];
    radius: number; // in meters
    orderCount: number;
    revenue: number;
    establishmentCount: number;
  }>;
  deliveryHeatmap: Array<{
    coordinates: [number, number];
    intensity: number; // 0-1 scale
    orderCount: number;
  }>;
  averageDeliveryDistance: MetricValue; // in km
}

export interface CustomerBehaviorAnalytics {
  averageOrdersPerCustomer: MetricValue;
  averageSessionDuration: MetricValue; // in minutes
  mostActiveHours: Record<string, number>; // hour -> order count
  mostActiveDays: Record<string, number>; // day -> order count
  customerSegments: Array<{
    segment: string;
    customerCount: number;
    averageOrderValue: number;
    orderFrequency: number;
    characteristics: string[];
  }>;
  customerJourney: Array<{
    stage: string;
    customerCount: number;
    conversionRate: number;
    averageTimeSpent: number; // in hours
  }>;
  repeatCustomerRate: MetricValue;
  customerSatisfactionScore: MetricValue;
}

// ==================== Advanced Analytics Interfaces ====================

export interface PredictiveAnalytics {
  demandForecast: Array<{
    date: Date;
    predictedOrders: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    category?: string;
    establishmentId?: string;
  }>;
  churnPrediction: Array<{
    userId: string;
    churnProbability: number; // 0-1 scale
    riskFactors: string[];
    recommendedActions: string[];
  }>;
  priceOptimization: Array<{
    offerId: string;
    currentPrice: number;
    suggestedPrice: number;
    expectedDemandIncrease: number;
    potentialRevenueImpact: number;
  }>;
  inventoryOptimization: Array<{
    establishmentId: string;
    category: string;
    currentStock: number;
    recommendedStock: number;
    wasteReductionPotential: number;
  }>;
}

export interface CompetitiveAnalytics {
  marketShare: MetricValue;
  competitorComparison: Array<{
    metric: string;
    ourValue: number;
    industryAverage: number;
    ranking: number;
    percentile: number;
  }>;
  pricingComparison: Array<{
    category: string;
    ourAveragePrice: number;
    marketAveragePrice: number;
    priceAdvantage: number; // percentage
  }>;
}

export interface CohortAnalytics {
  userCohorts: Array<{
    cohortMonth: string;
    cohortSize: number;
    retentionRates: Record<string, number>; // month -> retention rate
  }>;
  revenueCohorts: Array<{
    cohortMonth: string;
    initialRevenue: number;
    cumulativeRevenue: Record<string, number>; // month -> cumulative revenue
  }>;
}

// ==================== Filtering and Aggregation Interfaces ====================

export interface AnalyticsFilters {
  dateRange: TimeRange;
  establishmentIds?: string[] | undefined;
  userIds?: string[] | undefined;
  categories?: string[] | undefined;
  locations?:
    | Array<{
        city?: string;
        country?: string;
        coordinates?: [number, number];
        radius?: number; // in km
      }>
    | undefined;
  userRoles?: string[] | undefined;
  establishmentTypes?: string[] | undefined;
  orderStatuses?: string[] | undefined;
  paymentMethods?: string[] | undefined;
  minOrderValue?: number | undefined;
  maxOrderValue?: number | undefined;
  granularity: DateGranularity;
}

export interface AggregationOptions {
  groupBy?: string[] | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  includeProjections?: boolean | undefined;
  includeComparisons?: boolean | undefined;
}

// ==================== Controller Response Interfaces ====================

export interface QuickStatsResponse {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  sustainability: {
    foodSaved: number;
    carbonReduced: number;
  };
  period: string;
  generatedAt: Date;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'operations' | 'sustainability' | 'customer' | 'financial';
  preview: string;
  widgetCount: number;
  requiredRole?: string;
}

export interface CacheStatistics {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  keysByCategory: Record<string, number>;
  lastUpdated: Date;
}

// ==================== Dashboard Configuration Interfaces ====================

export interface WidgetVisualization {
  chartType?:
    | 'line'
    | 'bar'
    | 'pie'
    | 'donut'
    | 'area'
    | 'scatter'
    | 'stacked_bar'
    | 'radial_bar'
    | 'heatmap'
    | undefined;
  xAxis?: string | undefined;
  yAxis?: string | string[] | undefined;
  colorScheme?: string[] | undefined;
  colorBy?: string | undefined;
  field?: string | undefined;
  value?: string | undefined;
  metrics?: string[] | undefined;
  columns?: string[] | undefined;
  sorting?:
    | {
        column: string;
        direction: 'asc' | 'desc';
      }
    | undefined;
  mapType?: 'heat' | 'marker' | 'cluster' | undefined;
  centerLat?: number | undefined;
  centerLng?: number | undefined;
  zoom?: number | undefined;
  displayOptions?: Record<string, string | number | boolean> | undefined;
}

export interface Widget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'heatmap';
  title: string;
  description?: string;
  dataSource: string;
  visualization: WidgetVisualization;
  filters: Record<string, string | number | boolean | string[] | number[]>;
  refreshInterval?: number;
  position: {
    row: number;
    column: number;
    width: number;
    height: number;
  };
}

export interface WidgetConfig {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'heatmap';
  title: string;
  description?: string;
  dataSource: string;
  visualization: WidgetVisualization;
  filters: Record<string, string | number | boolean | string[] | number[]>; // Flexible filters to support various widget types
  refreshInterval?: number; // in minutes
  position: {
    row: number;
    column: number;
    width: number;
    height: number;
  };
}

export interface DashboardConfig {
  id: string;
  name: string;
  description?: string | undefined;
  category: 'business' | 'operations' | 'sustainability' | 'customer' | 'financial';
  widgets: Widget[];
  isDefault?: boolean | undefined;
  userId?: string | undefined; // for personal dashboards
  permissions?:
    | {
        viewRoles: string[];
        editRoles: string[];
      }
    | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Real-time Analytics Interfaces ====================

export interface RealTimeMetrics {
  activeUsers: number;
  ordersToday: number;
  revenueToday: number;
  activeOffers: number;
  pendingOrders: number;
  systemHealth: {
    responseTime: number;
    errorRate: number;
    uptime: number;
  };
  lastUpdated: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'percent_change';
  threshold: number;
  timeWindow: number; // in minutes
  isActive: boolean;
  notificationChannels: string[];
  lastTriggered?: Date;
  createdBy: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'triggered' | 'acknowledged' | 'resolved';
  metadata?: Record<string, string | number | boolean | Date>;
}

// ==================== Export/Report Interfaces ====================

export interface ReportConfig {
  id: string;
  name: string;
  type: 'scheduled' | 'on_demand';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  sections: string[]; // analytics sections to include
  filters: AnalyticsFilters;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:MM format
    timezone: string;
    recipients: string[];
  };
  template?: string;
  createdBy: string;
  isActive: boolean;
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeCharts?: boolean;
  includeRawData?: boolean;
  dateFormat?: string;
  currency?: string;
  language?: string;
}
