import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { MerchantDashboardService } from './services/merchant-dashboard.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { PerformanceAnalyticsService } from './services/performance-analytics.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';

@ApiTags('📊 Enhanced Analytics & Merchant Dashboard')
@Controller('analytics/enhanced')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EnhancedAnalyticsController {
  constructor(
    private readonly dashboardService: MerchantDashboardService,
    private readonly revenueService: RevenueAnalyticsService,
    private readonly performanceService: PerformanceAnalyticsService,
    private readonly predictiveService: PredictiveAnalyticsService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🏪 Get Merchant Dashboard Overview',
    description: 'Comprehensive business metrics and KPIs for merchants'
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    schema: {
      example: {
        period: '30d',
        revenue: {
          total: 2850.75,
          growth: 15.3,
          goalProgress: 68.5
        },
        orders: {
          total: 145,
          completed: 132,
          cancelled: 8,
          completionRate: 91.0
        },
        offers: {
          total: 23,
          active: 8,
          soldOut: 12,
          expired: 3
        },
        customers: {
          total: 87,
          new: 12,
          returning: 75,
          retentionRate: 86.2
        },
        topPerformingOffers: [
          {
            id: '507f1f77bcf86cd799439011',
            title: 'Fresh Bakery Mix',
            revenue: 485.20,
            orderCount: 28,
            rating: 4.8
          }
        ],
        insights: [
          {
            type: 'opportunity',
            title: 'Peak Hour Optimization',
            description: 'Consider adding more offers between 5-7 PM for 25% revenue increase',
            impact: 'high',
            actionRequired: true
          }
        ]
      }
    }
  })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d', '1y'], required: false, description: 'Analysis period' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Specific establishment (for multi-location merchants)' })
  async getDashboard(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const dashboard = await this.dashboardService.getMerchantDashboard(
      req.user.userId,
      period,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Dashboard data retrieved successfully',
      data: dashboard,
    };
  }

  @Get('revenue')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '💰 Revenue Analytics',
    description: 'Detailed revenue analysis with trends and projections'
  })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d', '1y'], required: false })
  @ApiQuery({ name: 'granularity', enum: ['hour', 'day', 'week', 'month'], required: false })
  async getRevenueAnalytics(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('granularity') granularity: string = 'day',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const analytics = await this.revenueService.getRevenueAnalytics(
      req.user.userId,
      period,
      granularity,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Revenue analytics retrieved successfully',
      data: analytics,
    };
  }

  @Get('performance')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '📈 Performance Analytics',
    description: 'Offer performance, customer behavior, and optimization insights'
  })
  async getPerformanceAnalytics(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const performance = await this.performanceService.getPerformanceMetrics(
      req.user.userId,
      period,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Performance analytics retrieved successfully',
      data: performance,
    };
  }

  @Get('offers/:id/insights')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🎯 Individual Offer Insights',
    description: 'Detailed analytics for a specific offer'
  })
  async getOfferInsights(
    @Param('id') offerId: string,
    @Request() req,
  ) {
    const insights = await this.performanceService.getOfferInsights(
      offerId,
      req.user.userId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Offer insights retrieved successfully',
      data: insights,
    };
  }

  @Get('predictions')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🔮 Predictive Analytics',
    description: 'AI-powered predictions and recommendations'
  })
  async getPredictions(
    @Request() req,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const predictions = await this.predictiveService.getPredictions(
      req.user.userId,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Predictions retrieved successfully',
      data: predictions,
    };
  }

  @Get('customer-insights')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '👥 Customer Analytics',
    description: 'Customer behavior, demographics, and segmentation'
  })
  async getCustomerInsights(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const insights = await this.dashboardService.getCustomerInsights(
      req.user.userId,
      period,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Customer insights retrieved successfully',
      data: insights,
    };
  }

  @Get('competitors')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🏪 Competitive Analysis',
    description: 'Market position and competitive benchmarks'
  })
  async getCompetitiveAnalysis(
    @Request() req,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const analysis = await this.dashboardService.getCompetitiveAnalysis(
      req.user.userId,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Competitive analysis retrieved successfully',
      data: analysis,
    };
  }

  @Get('sustainability')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🌱 Sustainability Impact',
    description: 'Environmental impact and waste reduction metrics'
  })
  async getSustainabilityMetrics(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const metrics = await this.dashboardService.getSustainabilityMetrics(
      req.user.userId,
      period,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Sustainability metrics retrieved successfully',
      data: metrics,
    };
  }

  @Get('reports/generate')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '📋 Generate Business Report',
    description: 'Generate comprehensive business report for specified period'
  })
  @ApiQuery({ name: 'format', enum: ['json', 'pdf', 'csv'], required: false })
  async generateReport(
    @Request() req,
    @Query('period') period: string = '30d',
    @Query('format') format: string = 'json',
    @Query('establishmentId') establishmentId?: string,
  ) {
    const report = await this.dashboardService.generateBusinessReport(
      req.user.userId,
      period,
      format,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Business report generated successfully',
      data: report,
    };
  }

  @Post('goals')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '🎯 Set Business Goals',
    description: 'Set and track business performance goals'
  })
  @HttpCode(HttpStatus.CREATED)
  async setBusinessGoals(
    @Request() req,
    @Query() goalsData: {
      revenueTarget?: number;
      orderTarget?: number;
      customerTarget?: number;
      wasteReductionTarget?: number;
      period?: string;
    },
  ) {
    const goals = await this.dashboardService.setBusinessGoals(
      req.user.userId,
      goalsData
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Business goals set successfully',
      data: goals,
    };
  }

  @Get('optimization-tips')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '💡 Business Optimization Tips',
    description: 'AI-powered recommendations for business improvement'
  })
  async getOptimizationTips(
    @Request() req,
    @Query('category') category?: string,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const tips = await this.predictiveService.getOptimizationTips(
      req.user.userId,
      category,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Optimization tips retrieved successfully',
      data: tips,
    };
  }

  @Get('trends')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '📊 Market Trends',
    description: 'Industry trends and market analysis for your area'
  })
  async getMarketTrends(
    @Request() req,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const trends = await this.predictiveService.getMarketTrends(
      req.user.userId,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Market trends retrieved successfully',
      data: trends,
    };
  }

  @Get('benchmarks')
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: '📏 Industry Benchmarks',
    description: 'Compare your performance against industry standards'
  })
  async getIndustryBenchmarks(
    @Request() req,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const benchmarks = await this.dashboardService.getIndustryBenchmarks(
      req.user.userId,
      establishmentId
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Industry benchmarks retrieved successfully',
      data: benchmarks,
    };
  }

  // Admin endpoints for system-wide analytics
  @Get('admin/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '🔧 Admin System Overview',
    description: 'System-wide analytics for administrators'
  })
  async getSystemOverview() {
    const overview = await this.dashboardService.getSystemOverview();

    return {
      statusCode: HttpStatus.OK,
      message: 'System overview retrieved successfully',
      data: overview,
    };
  }

  @Get('admin/merchants/top-performing')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '🏆 Top Performing Merchants',
    description: 'List of top performing merchants across the platform'
  })
  async getTopPerformingMerchants(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('period') period: string = '30d',
  ) {
    const merchants = await this.dashboardService.getTopPerformingMerchants(limit, period);

    return {
      statusCode: HttpStatus.OK,
      message: 'Top performing merchants retrieved successfully',
      data: merchants,
    };
  }
}