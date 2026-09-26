import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  DefaultValuePipe,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ProSubscriptionGuard } from '../../common/guards/pro-subscription.guard';
import { CreateDashboardDto, CreateWidgetDto } from '../dto/analytics.dto';
import { DashboardConfig, DashboardTemplate } from '../interfaces/analytics.interface';
import { DashboardService } from '../services/dashboard.service';
import { strictValidation } from '../../common/pipes/validation-pipes';

import { appError } from '../../common/errors';
@ApiTags('Analytics Dashboards')
@Controller('analytics/dashboards')
@UseGuards(JwtAuthGuard, ProSubscriptionGuard)
@ApiBearerAuth()
@UsePipes(strictValidation())
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  // ==================== Dashboard CRUD Operations ====================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new analytics dashboard',
    description: 'Create a personalized analytics dashboard with custom widgets and configuration',
  })
  @ApiBody({
    description: 'Dashboard configuration',
    type: CreateDashboardDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Dashboard created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '64b1c2e5f123456789abcdef' },
        name: { type: 'string', example: 'My Business Dashboard' },
        description: {
          type: 'string',
          example: 'Custom dashboard for monitoring business performance',
        },
        category: {
          type: 'string',
          enum: ['business', 'operations', 'sustainability', 'customer', 'financial'],
        },
        widgets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['metric', 'chart', 'table', 'map', 'heatmap'] },
              title: { type: 'string' },
              description: { type: 'string' },
              dataSource: { type: 'string' },
              visualization: { type: 'object' },
              filters: { type: 'object' },
              refreshInterval: { type: 'number' },
              position: {
                type: 'object',
                properties: {
                  row: { type: 'number' },
                  column: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
              },
            },
          },
        },
        isDefault: { type: 'boolean' },
        permissions: {
          type: 'object',
          properties: {
            viewRoles: { type: 'array', items: { type: 'string' } },
            editRoles: { type: 'array', items: { type: 'string' } },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid dashboard configuration' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Dashboard name already exists' })
  async createDashboard(
    @Body() createDashboardDto: CreateDashboardDto,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Creating dashboard: ${createDashboardDto.name} for user ${userId}`);
    const result = await this.dashboardService.createDashboard(
      createDashboardDto,
      userId,
      userRole,
    );
    return result;
  }

  @Get()
  @ApiOperation({
    summary: 'Get all accessible dashboards',
    description: 'Retrieve all dashboards that the user has permission to view',
  })
  @ApiQuery({
    name: 'category',
    enum: ['business', 'operations', 'sustainability', 'customer', 'financial'],
    required: false,
    description: 'Filter dashboards by category',
  })
  @ApiQuery({
    name: 'includePublic',
    type: 'boolean',
    required: false,
    description: 'Include public/shared dashboards',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboards retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Dashboard configuration object',
      },
    },
  })
  async getDashboards(
    @Query('category') category?: string,
    @Query('includePublic', new DefaultValuePipe(true), ParseBoolPipe) includePublic?: boolean,
    @GetUser('id') userId?: string,
    @GetUser('role') userRole?: string,
  ): Promise<DashboardConfig[]> {
    this.logger.log(`Getting dashboards for user ${userId}, category: ${category}`);
    if (!userId || !userRole) {
      throw new BadRequestException(appError('AUTH_REQUIRED'));
    }
    const result = await this.dashboardService.getDashboards(
      userId,
      userRole,
      category,
      includePublic,
    );
    return result;
  }

  @Get('default')
  @ApiOperation({
    summary: "Get user's default dashboard",
    description: 'Retrieve the default dashboard for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Default dashboard retrieved successfully',
    schema: {
      type: 'object',
      description: 'Dashboard configuration object',
    },
  })
  @ApiResponse({ status: 404, description: 'No default dashboard found' })
  async getDefaultDashboard(
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig | null> {
    this.logger.log(`Getting default dashboard for user ${userId}`);
    const result = await this.dashboardService.getDefaultDashboard(userId, userRole);
    return result;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get dashboard by ID',
    description: 'Retrieve a specific dashboard by its ID',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard retrieved successfully',
    schema: {
      type: 'object',
      description: 'Dashboard configuration object',
    },
  })
  @ApiResponse({ status: 404, description: 'Dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDashboard(
    @Param('id') dashboardId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Getting dashboard ${dashboardId} for user ${userId}`);
    const result = await this.dashboardService.getDashboard(dashboardId, userId, userRole);
    return result;
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update dashboard',
    description: 'Update an existing dashboard configuration',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiBody({
    description: 'Dashboard updates',
    type: CreateDashboardDto,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard updated successfully',
    schema: {
      type: 'object',
      description: 'Updated dashboard configuration',
    },
  })
  @ApiResponse({ status: 404, description: 'Dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateDashboard(
    @Param('id') dashboardId: string,
    @Body() updates: Partial<CreateDashboardDto>,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Updating dashboard ${dashboardId} by user ${userId}`);
    const result = await this.dashboardService.updateDashboard(
      dashboardId,
      updates,
      userId,
      userRole,
    );
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete dashboard',
    description: 'Delete a dashboard (soft delete - marks as inactive)',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiResponse({ status: 204, description: 'Dashboard deleted successfully' })
  @ApiResponse({ status: 404, description: 'Dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteDashboard(
    @Param('id') dashboardId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<void> {
    this.logger.log(`Deleting dashboard ${dashboardId} by user ${userId}`);
    await this.dashboardService.deleteDashboard(dashboardId, userId, userRole);
  }

  // ==================== Widget Operations ====================

  @Post(':id/widgets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add widget to dashboard',
    description: 'Add a new widget to an existing dashboard',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiBody({
    description: 'Widget configuration',
    type: CreateWidgetDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Widget added successfully',
    schema: {
      type: 'object',
      description: 'Updated dashboard configuration',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid widget configuration or position conflict' })
  @ApiResponse({ status: 404, description: 'Dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async addWidget(
    @Param('id') dashboardId: string,
    @Body() widget: CreateWidgetDto,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Adding widget to dashboard ${dashboardId} by user ${userId}`);
    const result = await this.dashboardService.addWidget(dashboardId, widget, userId, userRole);
    return result;
  }

  @Put(':id/widgets/:widgetId')
  @ApiOperation({
    summary: 'Update dashboard widget',
    description: 'Update an existing widget in a dashboard',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiParam({ name: 'widgetId', description: 'Widget ID' })
  @ApiBody({
    description: 'Widget updates',
    type: CreateWidgetDto,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Widget updated successfully',
    schema: {
      type: 'object',
      description: 'Updated dashboard configuration',
    },
  })
  @ApiResponse({ status: 404, description: 'Dashboard or widget not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateWidget(
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() updates: Partial<CreateWidgetDto>,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Updating widget ${widgetId} in dashboard ${dashboardId} by user ${userId}`);
    const result = await this.dashboardService.updateWidget(
      dashboardId,
      widgetId,
      updates,
      userId,
      userRole,
    );
    return result;
  }

  @Delete(':id/widgets/:widgetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove widget from dashboard',
    description: 'Remove a widget from a dashboard',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiParam({ name: 'widgetId', description: 'Widget ID' })
  @ApiResponse({
    status: 200,
    description: 'Widget removed successfully',
    schema: {
      type: 'object',
      description: 'Updated dashboard configuration',
    },
  })
  @ApiResponse({ status: 404, description: 'Dashboard or widget not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeWidget(
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Removing widget ${widgetId} from dashboard ${dashboardId} by user ${userId}`);
    const result = await this.dashboardService.removeWidget(
      dashboardId,
      widgetId,
      userId,
      userRole,
    );
    return result;
  }

  @Put(':id/default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set dashboard as default',
    description: 'Set a dashboard as the default for the current user',
  })
  @ApiParam({ name: 'id', description: 'Dashboard ID' })
  @ApiResponse({ status: 204, description: 'Default dashboard set successfully' })
  @ApiResponse({ status: 404, description: 'Dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async setDefaultDashboard(
    @Param('id') dashboardId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<void> {
    this.logger.log(`Setting dashboard ${dashboardId} as default for user ${userId}`);
    await this.dashboardService.setDefaultDashboard(dashboardId, userId, userRole);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Clone dashboard',
    description: 'Create a copy of an existing dashboard',
  })
  @ApiParam({ name: 'id', description: 'Source dashboard ID' })
  @ApiBody({
    description: 'Clone options',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the cloned dashboard' },
        description: { type: 'string', description: 'Description for the cloned dashboard' },
      },
      required: ['name'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dashboard cloned successfully',
    schema: {
      type: 'object',
      description: 'Cloned dashboard configuration',
    },
  })
  @ApiResponse({ status: 404, description: 'Source dashboard not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async cloneDashboard(
    @Param('id') sourceDashboardId: string,
    @Body() options: { name: string; description?: string },
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Cloning dashboard ${sourceDashboardId} for user ${userId}`);

    // Get the source dashboard
    const sourceDashboard = await this.dashboardService.getDashboard(
      sourceDashboardId,
      userId,
      userRole,
    );

    // Create clone DTO
    const cloneDto: CreateDashboardDto = {
      name: options.name,
      description: options.description ?? `Copy of ${sourceDashboard.name}`,
      category: sourceDashboard.category,
      widgets: sourceDashboard.widgets.map(widget => ({
        type: widget.type,
        title: widget.title,
        ...(widget.description !== undefined ? { description: widget.description } : {}),
        dataSource: widget.dataSource,
        visualization: widget.visualization,
        filters: widget.filters,
        ...(widget.refreshInterval !== undefined
          ? { refreshInterval: widget.refreshInterval }
          : {}),
        position: widget.position,
      })),
      isDefault: false, // Clones are never default
      permissions: sourceDashboard.permissions,
    };

    const result = await this.dashboardService.createDashboard(cloneDto, userId, userRole);
    return result;
  }

  // ==================== Dashboard Templates ====================

  @Get('templates/available')
  @ApiOperation({
    summary: 'Get available dashboard templates',
    description: 'Retrieve predefined dashboard templates that users can use as starting points',
  })
  @ApiResponse({
    status: 200,
    description: 'Available templates retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          preview: { type: 'string', description: 'Preview image URL' },
          widgetCount: { type: 'number' },
        },
      },
    },
  })
  getAvailableTemplates(@GetUser('role') userRole: string): DashboardTemplate[] {
    this.logger.log(`Getting available templates for role: ${userRole}`);

    // Validate user role
    const validRoles = ['admin', 'merchant', 'consumer'];
    if (!validRoles.includes(userRole)) {
      this.logger.warn(`Invalid user role provided: ${userRole}`);
      throw new BadRequestException(appError('INVALID_ROLE'));
    }

    // Define all available templates with comprehensive metadata
    const allTemplates: DashboardTemplate[] = [
      {
        id: 'business-overview',
        name: 'Business Overview',
        description:
          'Comprehensive business metrics including revenue, orders, customer acquisition, and food waste reduction impact',
        category: 'business',
        preview: '/templates/previews/business-overview.png',
        widgetCount: 6,
        requiredRole: 'merchant',
      },
      {
        id: 'sustainability-dashboard',
        name: 'Sustainability Impact',
        description:
          'Track environmental benefits: food saved, carbon footprint reduced, water conservation, and sustainability goals',
        category: 'sustainability',
        preview: '/templates/previews/sustainability.png',
        widgetCount: 4,
        requiredRole: 'merchant',
      },
      {
        id: 'customer-insights',
        name: 'Customer Analytics',
        description:
          'Deep customer behavior analysis, demographics, purchase patterns, and retention metrics',
        category: 'customer',
        preview: '/templates/previews/customer-insights.png',
        widgetCount: 5,
        requiredRole: 'merchant',
      },
      {
        id: 'operations-dashboard',
        name: 'Operations Control Center',
        description:
          'Real-time operational metrics, system health, inventory management, and performance monitoring',
        category: 'operations',
        preview: '/templates/previews/operations.png',
        widgetCount: 8,
        requiredRole: 'admin',
      },
      {
        id: 'financial-analytics',
        name: 'Financial Performance',
        description:
          'Revenue analysis, profit margins, cost optimization, payment trends, and financial forecasting',
        category: 'financial',
        preview: '/templates/previews/financial.png',
        widgetCount: 7,
        requiredRole: 'admin',
      },
      {
        id: 'consumer-activity',
        name: 'My Activity Dashboard',
        description:
          'Personal activity tracker showing orders, savings, environmental impact, and favorite merchants',
        category: 'customer',
        preview: '/templates/previews/consumer.png',
        widgetCount: 4,
        requiredRole: 'consumer',
      },
    ];

    // Filter templates based on user role with proper authorization logic
    const filteredTemplates = allTemplates.filter(template => {
      // Admin users can access all templates
      if (userRole === 'admin') {
        return true;
      }

      // Users can only access templates for their role or universal templates
      return (
        template.requiredRole === userRole ||
        (userRole === 'merchant' && template.requiredRole === 'consumer')
      ); // Merchants can see consumer templates for reference
    });

    this.logger.log(`Returning ${filteredTemplates.length} templates for role: ${userRole}`);
    return filteredTemplates;
  }

  @Post('templates/:templateId/apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create dashboard from template',
    description: 'Create a new dashboard using a predefined template',
  })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiBody({
    description: 'Dashboard customization options',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Custom name for the dashboard' },
        description: { type: 'string', description: 'Custom description' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dashboard created from template successfully',
    schema: {
      type: 'object',
      description: 'Created dashboard configuration',
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body() options: { name?: string; description?: string },
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ): Promise<DashboardConfig> {
    this.logger.log(`Creating dashboard from template ${templateId} for user ${userId}`);

    // Get available templates for validation and access control
    const availableTemplates = this.getAvailableTemplates(userRole);
    const template = availableTemplates.find(t => t.id === templateId);

    if (!template) {
      this.logger.warn(
        `Template ${templateId} not found or not accessible for user ${userId} with role ${userRole}`,
      );
      throw new BadRequestException(appError('DASHBOARD_TEMPLATE_NOT_FOUND'));
    }

    // Load template configuration based on templateId
    const templateDto = this.loadTemplateConfiguration(templateId, template, options);

    this.logger.log(`Successfully loaded template ${templateId} configuration for user ${userId}`);
    const result = await this.dashboardService.createDashboard(templateDto, userId, userRole);
    return result;
  }

  /**
   * Load comprehensive template configuration based on template ID
   * @private
   */
  private loadTemplateConfiguration(
    templateId: string,
    template: DashboardTemplate,
    options: { name?: string; description?: string },
  ): CreateDashboardDto {
    const requiredRole = template.requiredRole;
    if (!requiredRole) {
      throw new BadRequestException(appError('DASHBOARD_TEMPLATE_INVALID'));
    }

    const baseConfig = {
      name: options.name ?? template.name,
      description: options.description ?? template.description,
      category: template.category,
      isDefault: false,
      permissions: {
        viewRoles: [requiredRole],
        editRoles: [requiredRole],
      },
    };

    switch (templateId) {
      case 'business-overview':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'Total Revenue',
              description: 'Total revenue from surplus food sales',
              dataSource: 'business_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, currency: 'USD' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 15,
              position: { row: 1, column: 1, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Total Orders',
              description: 'Number of surplus food orders completed',
              dataSource: 'business_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 15,
              position: { row: 1, column: 3, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Customer Acquisition',
              description: 'New customers acquired this period',
              dataSource: 'customer_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 30,
              position: { row: 1, column: 5, width: 2, height: 1 },
            },
            {
              type: 'chart',
              title: 'Revenue vs Food Waste Reduction',
              description: 'Revenue impact of waste reduction initiatives',
              dataSource: 'business_sustainability_metrics',
              visualization: {
                chartType: 'line',
                xAxis: 'date',
                yAxis: ['revenue', 'waste_reduced_kg'],
                colorScheme: ['#10B981', '#F59E0B'],
              },
              filters: { period: 'last_90_days' },
              refreshInterval: 60,
              position: { row: 2, column: 1, width: 4, height: 2 },
            },
            {
              type: 'chart',
              title: 'Order Volume Trends',
              description: 'Daily order volume and peak times analysis',
              dataSource: 'order_metrics',
              visualization: {
                chartType: 'bar',
                xAxis: 'time_of_day',
                yAxis: 'order_count',
                colorScheme: ['#3B82F6'],
              },
              filters: { period: 'last_7_days' },
              refreshInterval: 30,
              position: { row: 2, column: 5, width: 2, height: 2 },
            },
            {
              type: 'table',
              title: 'Top Performing Items',
              description: 'Best-selling surplus food items by revenue',
              dataSource: 'product_performance',
              visualization: {
                columns: ['item_name', 'quantity_sold', 'revenue', 'waste_saved_kg'],
                sorting: { column: 'revenue', direction: 'desc' },
              },
              filters: { period: 'last_30_days', limit: 10 },
              refreshInterval: 60,
              position: { row: 4, column: 1, width: 6, height: 2 },
            },
          ],
        };

      case 'sustainability-dashboard':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'Food Saved (kg)',
              description: 'Total food waste prevented from landfills',
              dataSource: 'sustainability_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, unit: 'kg' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 30,
              position: { row: 1, column: 1, width: 3, height: 1 },
            },
            {
              type: 'metric',
              title: 'CO2 Reduced (tons)',
              description: 'Carbon footprint reduction from waste prevention',
              dataSource: 'sustainability_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, unit: 'tons CO2' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 30,
              position: { row: 1, column: 4, width: 3, height: 1 },
            },
            {
              type: 'chart',
              title: 'Environmental Impact Timeline',
              description: 'Monthly progress toward sustainability goals',
              dataSource: 'sustainability_metrics',
              visualization: {
                chartType: 'area',
                xAxis: 'date',
                yAxis: ['food_saved_kg', 'co2_reduced_kg', 'water_saved_liters'],
                colorScheme: ['#10B981', '#059669', '#0D9488'],
              },
              filters: { period: 'last_12_months' },
              refreshInterval: 120,
              position: { row: 2, column: 1, width: 6, height: 2 },
            },
            {
              type: 'heatmap',
              title: 'Waste Reduction by Category',
              description: 'Food category waste reduction heatmap',
              dataSource: 'category_sustainability',
              visualization: {
                xAxis: 'food_category',
                yAxis: 'month',
                value: 'waste_reduced_kg',
                colorScheme: ['#FEF3C7', '#10B981'],
              },
              filters: { period: 'last_6_months' },
              refreshInterval: 240,
              position: { row: 4, column: 1, width: 6, height: 2 },
            },
          ],
        };

      case 'customer-insights':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'Active Customers',
              description: 'Total active customers this month',
              dataSource: 'customer_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { period: 'last_30_days', status: 'active' },
              refreshInterval: 60,
              position: { row: 1, column: 1, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Customer Retention',
              description: 'Monthly customer retention rate',
              dataSource: 'customer_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, unit: '%' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 120,
              position: { row: 1, column: 3, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Avg Order Value',
              description: 'Average order value per customer',
              dataSource: 'customer_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, currency: 'USD' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 60,
              position: { row: 1, column: 5, width: 2, height: 1 },
            },
            {
              type: 'chart',
              title: 'Customer Demographics',
              description: 'Age and location distribution of customers',
              dataSource: 'customer_demographics',
              visualization: {
                chartType: 'pie',
                field: 'age_group',
                colorScheme: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
              },
              filters: {},
              refreshInterval: 240,
              position: { row: 2, column: 1, width: 3, height: 2 },
            },
            {
              type: 'chart',
              title: 'Purchase Behavior Patterns',
              description: 'Customer purchase frequency and timing',
              dataSource: 'customer_behavior',
              visualization: {
                chartType: 'scatter',
                xAxis: 'days_since_last_order',
                yAxis: 'total_orders',
                colorBy: 'customer_segment',
                colorScheme: ['#8B5CF6', '#06B6D4', '#84CC16'],
              },
              filters: { period: 'last_90_days' },
              refreshInterval: 120,
              position: { row: 2, column: 4, width: 3, height: 2 },
            },
          ],
        };

      case 'operations-dashboard':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'System Uptime',
              description: 'Platform availability percentage',
              dataSource: 'system_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, unit: '%' },
              },
              filters: { period: 'last_24_hours' },
              refreshInterval: 5,
              position: { row: 1, column: 1, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Active Merchants',
              description: 'Currently active food establishments',
              dataSource: 'merchant_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { status: 'active', period: 'real_time' },
              refreshInterval: 10,
              position: { row: 1, column: 3, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Processing Orders',
              description: 'Orders currently being processed',
              dataSource: 'order_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: false },
              },
              filters: { status: 'processing', period: 'real_time' },
              refreshInterval: 5,
              position: { row: 1, column: 5, width: 2, height: 1 },
            },
            {
              type: 'chart',
              title: 'API Response Times',
              description: 'System performance monitoring',
              dataSource: 'performance_metrics',
              visualization: {
                chartType: 'line',
                xAxis: 'timestamp',
                yAxis: 'response_time_ms',
                colorScheme: ['#10B981', '#F59E0B', '#EF4444'],
              },
              filters: { period: 'last_1_hour' },
              refreshInterval: 10,
              position: { row: 2, column: 1, width: 4, height: 2 },
            },
            {
              type: 'table',
              title: 'System Alerts',
              description: 'Recent system alerts and warnings',
              dataSource: 'system_alerts',
              visualization: {
                columns: ['timestamp', 'severity', 'component', 'message', 'status'],
                sorting: { column: 'timestamp', direction: 'desc' },
              },
              filters: { period: 'last_24_hours', limit: 20 },
              refreshInterval: 15,
              position: { row: 2, column: 5, width: 2, height: 2 },
            },
            {
              type: 'map',
              title: 'Geographic Activity',
              description: 'Real-time order activity by location',
              dataSource: 'geolocation_metrics',
              visualization: {
                mapType: 'heat',
                centerLat: 40.7128,
                centerLng: -74.006,
                zoom: 10,
                colorScheme: ['#3B82F6', '#EF4444'],
              },
              filters: { period: 'last_1_hour' },
              refreshInterval: 30,
              position: { row: 4, column: 1, width: 3, height: 2 },
            },
            {
              type: 'chart',
              title: 'Inventory Levels',
              description: 'Real-time inventory tracking across merchants',
              dataSource: 'inventory_metrics',
              visualization: {
                chartType: 'bar',
                xAxis: 'merchant_name',
                yAxis: 'available_items',
                colorScheme: ['#10B981', '#F59E0B', '#EF4444'],
              },
              filters: { status: 'active', limit: 20 },
              refreshInterval: 15,
              position: { row: 4, column: 4, width: 3, height: 2 },
            },
          ],
        };

      case 'financial-analytics':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'Total Revenue',
              description: 'Platform total revenue this month',
              dataSource: 'financial_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, currency: 'USD' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 30,
              position: { row: 1, column: 1, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Profit Margin',
              description: 'Platform profit margin percentage',
              dataSource: 'financial_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, unit: '%' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 60,
              position: { row: 1, column: 3, width: 2, height: 1 },
            },
            {
              type: 'metric',
              title: 'Transaction Volume',
              description: 'Total number of completed transactions',
              dataSource: 'payment_metrics',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { period: 'last_30_days', status: 'completed' },
              refreshInterval: 30,
              position: { row: 1, column: 5, width: 2, height: 1 },
            },
            {
              type: 'chart',
              title: 'Revenue Breakdown',
              description: 'Revenue by merchant category and commission',
              dataSource: 'revenue_breakdown',
              visualization: {
                chartType: 'stacked_bar',
                xAxis: 'date',
                yAxis: ['merchant_revenue', 'platform_commission'],
                colorScheme: ['#10B981', '#3B82F6'],
              },
              filters: { period: 'last_90_days' },
              refreshInterval: 120,
              position: { row: 2, column: 1, width: 4, height: 2 },
            },
            {
              type: 'chart',
              title: 'Payment Methods',
              description: 'Distribution of payment methods used',
              dataSource: 'payment_analytics',
              visualization: {
                chartType: 'donut',
                field: 'payment_method',
                colorScheme: ['#8B5CF6', '#06B6D4', '#84CC16', '#F59E0B'],
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 120,
              position: { row: 2, column: 5, width: 2, height: 2 },
            },
            {
              type: 'table',
              title: 'Top Revenue Merchants',
              description: 'Highest earning merchants this period',
              dataSource: 'merchant_revenue',
              visualization: {
                columns: [
                  'merchant_name',
                  'total_revenue',
                  'order_count',
                  'avg_order_value',
                  'commission_earned',
                ],
                sorting: { column: 'total_revenue', direction: 'desc' },
              },
              filters: { period: 'last_30_days', limit: 15 },
              refreshInterval: 60,
              position: { row: 4, column: 1, width: 4, height: 2 },
            },
            {
              type: 'chart',
              title: 'Financial Forecasting',
              description: 'Revenue projection and growth trends',
              dataSource: 'financial_forecasting',
              visualization: {
                chartType: 'line',
                xAxis: 'date',
                yAxis: ['actual_revenue', 'projected_revenue'],
                colorScheme: ['#10B981', '#F59E0B'],
              },
              filters: { period: 'last_6_months_plus_forecast' },
              refreshInterval: 240,
              position: { row: 4, column: 5, width: 2, height: 2 },
            },
          ],
        };

      case 'consumer-activity':
        return {
          ...baseConfig,
          widgets: [
            {
              type: 'metric',
              title: 'My Total Orders',
              description: 'Total orders placed this month',
              dataSource: 'user_activity',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 60,
              position: { row: 1, column: 1, width: 3, height: 1 },
            },
            {
              type: 'metric',
              title: 'Money Saved',
              description: 'Total savings from discounted surplus food',
              dataSource: 'user_savings',
              visualization: {
                displayOptions: { showTrend: true, showComparison: true, currency: 'USD' },
              },
              filters: { period: 'last_30_days' },
              refreshInterval: 60,
              position: { row: 1, column: 4, width: 3, height: 1 },
            },
            {
              type: 'chart',
              title: 'My Environmental Impact',
              description: 'Personal contribution to waste reduction',
              dataSource: 'user_sustainability',
              visualization: {
                chartType: 'radial_bar',
                metrics: ['food_saved_kg', 'co2_reduced_kg', 'water_saved_liters'],
                colorScheme: ['#10B981', '#059669', '#0D9488'],
              },
              filters: { period: 'last_90_days' },
              refreshInterval: 120,
              position: { row: 2, column: 1, width: 3, height: 2 },
            },
            {
              type: 'table',
              title: 'Favorite Merchants',
              description: 'Most frequently ordered from merchants',
              dataSource: 'user_favorites',
              visualization: {
                columns: ['merchant_name', 'order_count', 'total_spent', 'last_order_date'],
                sorting: { column: 'order_count', direction: 'desc' },
              },
              filters: { period: 'all_time', limit: 10 },
              refreshInterval: 240,
              position: { row: 2, column: 4, width: 3, height: 2 },
            },
          ],
        };

      default:
        this.logger.error(`Unknown template ID: ${templateId}`);
        throw new BadRequestException(appError('DASHBOARD_TEMPLATE_NOT_FOUND'));
    }
  }
}
