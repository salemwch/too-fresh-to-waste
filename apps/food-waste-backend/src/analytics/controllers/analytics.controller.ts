import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import {
  BusinessMetricsRequestDto,
  UserAnalyticsRequestDto,
  AnalyticsFiltersDto,
} from '../dto/analytics.dto';
import {
  BusinessMetrics,
  UserAnalytics,
  RealTimeMetrics,
  QuickStatsResponse,
  CacheStatistics,
} from '../interfaces/analytics.interface';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  // ==================== Business Metrics ====================

  @Post('business-metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get comprehensive business metrics',
    description:
      'Retrieve key business performance indicators including revenue, orders, conversion rates, and sustainability impact',
  })
  @ApiBody({
    description: 'Business metrics request parameters',
    type: BusinessMetricsRequestDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Business metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRevenue: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 125000.5 },
            previousValue: { type: 'number', example: 118000.25 },
            changePercentage: { type: 'number', example: 5.93 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
          },
        },
        totalOrders: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 1250 },
            previousValue: { type: 'number', example: 1180 },
            changePercentage: { type: 'number', example: 5.93 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
          },
        },
        averageOrderValue: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 15.25 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'stable' },
          },
        },
        conversionRate: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 85.5 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
          },
        },
        foodWasteSaved: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 2500 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
          },
        },
        carbonFootprintReduced: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 6250 },
            trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getBusinessMetrics(
    @Body() request: BusinessMetricsRequestDto,
    @GetUser('id') userId: string,
  ): Promise<BusinessMetrics> {
    this.logger.log(`Getting business metrics for user ${userId}`);
    const result = await this.analyticsService.getBusinessMetrics(request);
    return result;
  }

  // ==================== User Analytics ====================

  @Post('user-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user analytics and behavior insights',
    description: 'Retrieve user growth, demographics, location data, and behavior patterns',
  })
  @ApiBody({
    description: 'User analytics request parameters',
    type: UserAnalyticsRequestDto,
  })
  @ApiResponse({
    status: 200,
    description: 'User analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalUsers: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 15000 },
            changePercentage: { type: 'number', example: 12.5 },
            trend: { type: 'string', example: 'up' },
          },
        },
        activeUsers: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 8500 },
            trend: { type: 'string', example: 'up' },
          },
        },
        newUsers: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 1200 },
            trend: { type: 'string', example: 'up' },
          },
        },
        retentionRate: {
          type: 'object',
          properties: {
            value: { type: 'number', example: 68.5 },
            trend: { type: 'string', example: 'stable' },
          },
        },
        usersByRole: {
          type: 'object',
          example: { consumer: 14200, merchant: 800 },
        },
        usersByLocation: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Paris' },
              country: { type: 'string', example: 'France' },
              count: { type: 'number', example: 2500 },
              coordinates: {
                type: 'array',
                items: { type: 'number' },
                example: [2.3522, 48.8566],
              },
            },
          },
        },
        userGrowthSeries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              value: { type: 'number' },
              label: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getUserAnalytics(
    @Body() request: UserAnalyticsRequestDto,
    @GetUser('id') userId: string,
  ): Promise<UserAnalytics> {
    this.logger.log(`Getting user analytics for user ${userId}`);
    const result = await this.analyticsService.getUserAnalytics(request);
    return result;
  }

  // ==================== Real-time Metrics ====================

  @Get('real-time')
  @ApiOperation({
    summary: 'Get real-time system metrics',
    description:
      "Retrieve current system status including active users, today's orders, revenue, and system health",
  })
  @ApiResponse({
    status: 200,
    description: 'Real-time metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        activeUsers: { type: 'number', example: 245 },
        ordersToday: { type: 'number', example: 89 },
        revenueToday: { type: 'number', example: 1250.75 },
        activeOffers: { type: 'number', example: 342 },
        pendingOrders: { type: 'number', example: 12 },
        systemHealth: {
          type: 'object',
          properties: {
            responseTime: { type: 'number', example: 45 },
            errorRate: { type: 'number', example: 0.1 },
            uptime: { type: 'number', example: 99.9 },
          },
        },
        lastUpdated: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getRealTimeMetrics(@GetUser('id') userId: string): Promise<RealTimeMetrics> {
    this.logger.log(`Getting real-time metrics for user ${userId}`);
    const result = await this.analyticsService.getRealTimeMetrics();
    return result;
  }

  // ==================== Quick Metrics ====================

  @Get('quick-stats')
  @ApiOperation({
    summary: 'Get quick overview statistics',
    description: 'Retrieve key metrics for dashboard widgets and quick overview displays',
  })
  @ApiQuery({ name: 'period', enum: ['today', 'week', 'month', 'quarter'], required: false })
  @ApiQuery({ name: 'category', type: 'string', required: false })
  @ApiResponse({
    status: 200,
    description: 'Quick statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        revenue: { type: 'number' },
        orders: { type: 'number' },
        users: { type: 'number' },
        establishments: { type: 'number' },
        sustainability: {
          type: 'object',
          properties: {
            foodSaved: { type: 'number' },
            carbonReduced: { type: 'number' },
          },
        },
      },
    },
  })
  async getQuickStats(
    @GetUser('id') userId: string,
    @Query('period') period: string = 'month',
    @Query('category') category?: string,
  ): Promise<QuickStatsResponse> {
    this.logger.log(`Getting quick stats for user ${userId}, period: ${period}`);

    // Build date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'week': {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'quarter': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      }
      default: {
        // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    const request: BusinessMetricsRequestDto = {
      filters: {
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
        },
        granularity: {
          period: 'day',
        },
        ...(category && { categories: [category] }),
      },
      includeSustainability: true,
    };

    const metrics = await this.analyticsService.getBusinessMetrics(request);

    return {
      revenue: metrics.totalRevenue.value,
      orders: metrics.totalOrders.value,
      averageOrderValue: metrics.averageOrderValue.value,
      sustainability: {
        foodSaved: metrics.foodWasteSaved.value,
        carbonReduced: metrics.carbonFootprintReduced.value,
      },
      period,
      generatedAt: new Date(),
    };
  }

  // ==================== Cache Management ====================

  @Post('cache/invalidate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Invalidate analytics cache',
    description: 'Clear cached analytics data for fresh calculations',
  })
  @ApiQuery({ name: 'category', type: 'string', required: false })
  @ApiQuery({ name: 'tags', type: 'string', required: false, description: 'Comma-separated tags' })
  @ApiResponse({ status: 204, description: 'Cache invalidated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async invalidateCache(
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @GetUser('role') userRole?: string,
  ): Promise<void> {
    // Only admin can invalidate cache
    if (userRole !== 'admin') {
      throw new BadRequestException('Only administrators can invalidate cache');
    }

    const tagArray = tags ? tags.split(',').map((t) => t.trim()) : undefined;
    await this.analyticsService.invalidateCache(category, tagArray);

    this.logger.log(`Cache invalidated - category: ${category}, tags: ${tags}`);
  }

  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Retrieve analytics cache performance and usage statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalEntries: { type: 'number' },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              count: { type: 'number' },
              totalSize: { type: 'number' },
              avgComputationTime: { type: 'number' },
            },
          },
        },
        hitRates: {
          type: 'object',
          properties: {
            totalHits: { type: 'number' },
            avgHitRate: { type: 'number' },
          },
        },
      },
    },
  })
  async getCacheStats(@GetUser('role') userRole: string): Promise<CacheStatistics> {
    if (userRole !== 'admin') {
      throw new BadRequestException('Only administrators can view cache statistics');
    }

    const result = await this.analyticsService.getCacheStatistics();
    return result;
  }

  // ==================== Data Validation ====================

  @Post('validate-filters')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate analytics filters',
    description: 'Validate analytics filter parameters before submitting analytics requests',
  })
  @ApiBody({
    description: 'Analytics filters to validate',
    type: AnalyticsFiltersDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Filters validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: {
          type: 'array',
          items: { type: 'string' },
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  validateFilters(@Body() filters: AnalyticsFiltersDto): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    if (startDate >= endDate) {
      errors.push('Start date must be before end date');
    }

    // Check date range reasonableness
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      warnings.push('Date range exceeds 1 year - this may impact performance');
    }

    if (daysDiff < 1) {
      warnings.push('Date range is less than 1 day - limited data may be available');
    }

    // Check establishment filter size
    if (filters.establishmentIds && filters.establishmentIds.length > 50) {
      warnings.push(
        'Large number of establishments selected - consider filtering for better performance',
      );
    }

    // Check granularity vs date range
    if (filters.granularity.period === 'hour' && daysDiff > 7) {
      warnings.push('Hourly granularity with long date range may result in many data points');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== Health Check ====================

  @Get('health')
  @ApiOperation({
    summary: 'Analytics service health check',
    description: 'Check the health and status of the analytics service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'connected' },
            cache: { type: 'string', example: 'enabled' },
            eventEmitter: { type: 'string', example: 'active' },
          },
        },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  getHealth(): {
    status: string;
    timestamp: Date;
    services: {
      database: string;
      cache: string;
      eventEmitter: string;
    };
    version: string;
  } {
    // This would typically check database connections, cache status, etc.
    return {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'connected',
        cache: 'enabled',
        eventEmitter: 'active',
      },
      version: '1.0.0',
    };
  }
}
