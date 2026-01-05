import { Types, PipelineStage } from 'mongoose';
import { createHash } from 'crypto';
import {
  TimeRange,
  DateGranularity,
  MetricValue,
  TimeSeries,
  AnalyticsFilters
} from '../interfaces/analytics.interface';

// MongoDB query operator interfaces for type safety
interface MongoDateRangeQuery {
  $gte: Date;
  $lte: Date;
}

interface MongoInQuery<T> {
  $in: T[];
}

interface MongoRangeQuery {
  $gte?: number;
  $lte?: number;
}

interface MongoMatchStage {
  createdAt?: MongoDateRangeQuery;
  establishmentId?: MongoInQuery<Types.ObjectId>;
  userId?: MongoInQuery<Types.ObjectId>;
  categories?: MongoInQuery<string>;
  'user.role'?: MongoInQuery<string>;
  status?: MongoInQuery<string>;
  'payment.method'?: MongoInQuery<string>;
  'payment.amount'?: MongoRangeQuery;
  [key: string]: unknown;
}

export class AnalyticsUtil {

  /**
   * Generate a unique cache key hash for analytics queries
   */
  static generateCacheKey(
    endpoint: string,
    filters: Record<string, unknown>,
    aggregation?: Record<string, unknown>
  ): string {
    const keyObject = {
      endpoint,
      filters: this.normalizeFilters(filters),
      aggregation: aggregation || {},
      version: '1.0.0'
    };

    const keyString = JSON.stringify(keyObject, Object.keys(keyObject).sort((a, b) => a.localeCompare(b)));
    return createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Normalize filters for consistent caching
   */
  private static normalizeFilters(filters: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    Object.keys(filters).sort((a, b) => a.localeCompare(b)).forEach(key => {
      let value = filters[key];
      if (value instanceof Types.ObjectId) {
        value = value.toString();
      } else if (Array.isArray(value) && value.some(v => v instanceof Types.ObjectId)) {
        value = value.map(v => v instanceof Types.ObjectId ? v.toString() : v).sort((a, b) => {
          // Type-safe comparison for mixed array elements
          const aStr = String(a);
          const bStr = String(b);
          return aStr.localeCompare(bStr);
        });
      } else if (Array.isArray(value)) {
        value = [...value].sort((a, b) => {
          // Type-safe comparison for unknown array elements
          const aStr = String(a);
          const bStr = String(b);
          return aStr.localeCompare(bStr);
        });
      }

      normalized[key] = value;
    });

    return normalized;
  }

  /**
   * Calculate metric value with trend analysis
   */
  static calculateMetricValue(
    current: number,
    previous?: number,
    precision: number = 2
  ): MetricValue {
    const value = parseFloat(current.toFixed(precision));

    if (previous === undefined) {
      return {
        value,
        trend: 'stable'
      };
    }

    const previousValue = parseFloat(previous.toFixed(precision));
    let changePercentage: number;
    if (previousValue === 0) {
      if (current > 0) {
        changePercentage = 100;
      } else {
        changePercentage = 0;
      }
    } else {
      changePercentage = parseFloat((((current - previous) / previous) * 100).toFixed(2));
    }
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 0.01) { // 0.01% threshold
      trend = changePercentage > 0 ? 'up' : 'down';
    }

    return {
      value,
      previousValue,
      changePercentage,
      trend
    };
  }

  /**
   * Generate date range for comparison period
   */
  static getComparisonDateRange(dateRange: TimeRange, _granularity: DateGranularity): TimeRange {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const duration = end.getTime() - start.getTime();

    return {
      startDate: new Date(start.getTime() - duration),
      endDate: new Date(start.getTime())
    };
  }

  /**
   * Generate MongoDB aggregation pipeline for date grouping
   */
  static getDateGroupingPipeline(granularity: DateGranularity, dateField: string = 'createdAt'): PipelineStage[] {
    const timezone = granularity.timezone || 'UTC';

    const formatMap = {
      hour: '%Y-%m-%d %H:00',
      day: '%Y-%m-%d',
      week: '%Y-W%U',
      month: '%Y-%m',
      quarter: '%Y-Q%q',
      year: '%Y'
    };

    const format = formatMap[granularity.period];

    return [
      {
        $addFields: {
          dateKey: {
            $dateToString: {
              format,
              date: `$${dateField}`,
              timezone
            }
          }
        }
      } as PipelineStage
    ];
  }

  /**
   * Create MongoDB match pipeline from analytics filters
   */
  static createMatchPipeline(filters: AnalyticsFilters): PipelineStage[] {
    const matchStage: MongoMatchStage = {};

    // Date range filter
    if (filters.dateRange) {
      matchStage.createdAt = {
        $gte: new Date(filters.dateRange.startDate),
        $lte: new Date(filters.dateRange.endDate)
      };
    }

    // Establishment filter
    if (filters.establishmentIds?.length) {
      matchStage.establishmentId = {
        $in: filters.establishmentIds.map(id => new Types.ObjectId(id))
      };
    }

    // User filter
    if (filters.userIds?.length) {
      matchStage.userId = {
        $in: filters.userIds.map(id => new Types.ObjectId(id))
      };
    }

    // Categories filter
    if (filters.categories?.length) {
      matchStage.categories = { $in: filters.categories };
    }

    // User roles filter
    if (filters.userRoles?.length) {
      matchStage['user.role'] = { $in: filters.userRoles };
    }

    // Order status filter
    if (filters.orderStatuses?.length) {
      matchStage.status = { $in: filters.orderStatuses };
    }

    // Payment method filter
    if (filters.paymentMethods?.length) {
      matchStage['payment.method'] = { $in: filters.paymentMethods };
    }

    // Order value filters
    if (filters.minOrderValue !== undefined || filters.maxOrderValue !== undefined) {
      const amountFilter: MongoRangeQuery = {};
      if (filters.minOrderValue !== undefined) {
        amountFilter.$gte = filters.minOrderValue;
      }
      if (filters.maxOrderValue !== undefined) {
        amountFilter.$lte = filters.maxOrderValue;
      }
      matchStage['payment.amount'] = amountFilter;
    }

    return Object.keys(matchStage).length > 0 ? [{ $match: matchStage } as PipelineStage] : [];
  }

  /**
   * Generate time series data with proper date formatting
   */
  static generateTimeSeries(
    data: Array<{ dateKey: string; value: number }>,
    dateRange: TimeRange,
    granularity: DateGranularity
  ): TimeSeries[] {
    const result: TimeSeries[] = [];
    const dataMap = new Map(data.map(d => [d.dateKey, d.value]));

    const current = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    while (current <= end) {
      const key = this.formatDateKey(current, granularity);
      const value = dataMap.get(key) || 0;

      result.push({
        timestamp: new Date(current),
        value,
        label: this.formatDateLabel(current, granularity)
      });

      this.incrementDate(current, granularity);
    }

    return result;
  }

  /**
   * Format date according to granularity
   */
  private static formatDateKey(date: Date, granularity: DateGranularity): string {
    const formatMap = {
      hour: () => date.toISOString().substring(0, 13) + ':00',
      day: () => date.toISOString().substring(0, 10),
      week: () => {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${week.toString().padStart(2, '0')}`;
      },
      month: () => date.toISOString().substring(0, 7),
      quarter: () => {
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${year}-Q${quarter}`;
      },
      year: () => date.getFullYear().toString()
    };

    return formatMap[granularity.period]();
  }

  /**
   * Format date label for display
   */
  private static formatDateLabel(date: Date, granularity: DateGranularity): string {
    const formatMap = {
      hour: () => date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true
      }),
      day: () => date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      week: () => `Week ${this.getWeekNumber(date)}, ${date.getFullYear()}`,
      month: () => date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      }),
      quarter: () => {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      },
      year: () => date.getFullYear().toString()
    };

    return formatMap[granularity.period]();
  }

  /**
   * Increment date according to granularity
   */
  private static incrementDate(date: Date, granularity: DateGranularity): void {
    switch (granularity.period) {
      case 'hour':
        date.setHours(date.getHours() + 1);
        break;
      case 'day':
        date.setDate(date.getDate() + 1);
        break;
      case 'week':
        date.setDate(date.getDate() + 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarter':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
  }

  /**
   * Get week number of the year
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Calculate sustainability metrics
   */
  static calculateSustainabilityMetrics(foodSavedKg: number): {
    carbonReduced: number;
    waterSaved: number;
    mealsSaved: number;
  } {
    // Average carbon footprint: 2.5 kg CO2 per kg of food
    const carbonReduced = foodSavedKg * 2.5;

    // Average water footprint: 1000 liters per kg of food
    const waterSaved = foodSavedKg * 1000;

    // Average meal weight: 0.5 kg
    const mealsSaved = Math.floor(foodSavedKg / 0.5);

    return {
      carbonReduced: parseFloat(carbonReduced.toFixed(2)),
      waterSaved: parseFloat(waterSaved.toFixed(2)),
      mealsSaved
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Paginate results
   */
  static paginateResults<T>(
    results: T[],
    limit: number = 100,
    offset: number = 0
  ): { data: T[]; total: number; hasMore: boolean } {
    const total = results.length;
    const data = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { data, total, hasMore };
  }

  /**
   * Format currency value
   */
  static formatCurrency(value: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value);
  }

  /**
   * Format large numbers with appropriate units
   */
  static formatLargeNumber(value: number): string {
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(1) + 'B';
    } else if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    } else if (value >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  /**
   * Calculate percentile
   */
  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {return 0;}

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate moving average
   */
  static calculateMovingAverage(values: number[], windowSize: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const average = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(average);
    }

    return result;
  }

  /**
   * Validate analytics filters
   */
  static validateAnalyticsFilters(filters: Partial<AnalyticsFilters>): string[] {
    const errors: string[] = [];

    if (!filters.dateRange) {
      errors.push('Date range is required');
    } else {
      const start = new Date(filters.dateRange.startDate);
      const end = new Date(filters.dateRange.endDate);

      if (start >= end) {
        errors.push('Start date must be before end date');
      }

      // Limit to 2 years max
      const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in ms
      if (end.getTime() - start.getTime() > maxRange) {
        errors.push('Date range cannot exceed 2 years');
      }
    }

    if (filters.establishmentIds && filters.establishmentIds.length > 100) {
      errors.push('Cannot filter by more than 100 establishments');
    }

    if (filters.userIds && filters.userIds.length > 100) {
      errors.push('Cannot filter by more than 100 users');
    }

    return errors;
  }
}