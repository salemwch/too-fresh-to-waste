import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateDashboardDto, CreateWidgetDto } from '../dto/analytics.dto';
import {
  DashboardConfig as IDashboardConfig,
  DashboardTemplate,
} from '../interfaces/analytics.interface';
import {
  DashboardConfig,
  DashboardConfigDocument,
  WidgetPosition,
  Widget,
} from '../schemas/dashboard-config.schema';
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(DashboardConfig.name)
    private readonly dashboardModel: Model<DashboardConfigDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== Dashboard CRUD Operations ====================

  /**
   * Create a new dashboard
   */
  async createDashboard(
    createDashboardDto: CreateDashboardDto,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      // Validate user permissions
      if (!this.canCreateDashboard(userRole)) {
        throw new ForbiddenException('Insufficient permissions to create dashboard');
      }

      // Check for duplicate names for the user
      const existingDashboard = await this.dashboardModel.findOne({
        name: createDashboardDto.name,
        $or: [
          { userId: new Types.ObjectId(userId) },
          { userId: { $exists: false } }, // Global dashboards
        ],
      });

      if (existingDashboard) {
        throw new ConflictException('Dashboard with this name already exists');
      }

      // Validate widgets
      this.validateWidgets(createDashboardDto.widgets);

      // If setting as default, unset other defaults for this user
      if (createDashboardDto.isDefault === true) {
        await this.dashboardModel.updateMany(
          {
            userId: new Types.ObjectId(userId),
            isDefault: true,
          },
          { $set: { isDefault: false } },
        );
      }

      // Generate widget IDs
      const widgets = createDashboardDto.widgets.map((widget) => ({
        ...widget,
        id: new Types.ObjectId().toString(),
      }));

      // Create dashboard
      const dashboard = new this.dashboardModel({
        name: createDashboardDto.name,
        description: createDashboardDto.description,
        category: createDashboardDto.category,
        widgets,
        isDefault: createDashboardDto.isDefault ?? false,
        userId: new Types.ObjectId(userId),
        permissions: createDashboardDto.permissions ?? {
          viewRoles: [userRole],
          editRoles: [userRole],
        },
        createdBy: new Types.ObjectId(userId),
        tags: [],
        version: 1,
      });

      const savedDashboard = await dashboard.save();

      this.logger.log(`Dashboard created: ${savedDashboard.name} by user ${userId}`);

      // Emit event
      this.eventEmitter.emit('analytics.dashboard.created', {
        dashboardId: savedDashboard._id,
        userId,
        category: createDashboardDto.category,
      });

      return this.mapToInterface(savedDashboard);
    } catch (error) {
      this.logger.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(
    dashboardId: string,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      // Check permissions
      if (!this.canViewDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to view dashboard');
      }

      // Update view statistics
      await this.dashboardModel.updateOne(
        { _id: dashboardId },
        {
          $inc: { viewCount: 1 },
          $set: { lastViewedAt: new Date() },
        },
      );

      return this.mapToInterface(dashboard);
    } catch (error) {
      this.logger.error('Failed to get dashboard:', error);
      throw error;
    }
  }

  /**
   * Get all dashboards accessible to user
   */
  async getDashboards(
    userId: string,
    userRole: string,
    category?: string,
    includePublic: boolean = true,
  ): Promise<IDashboardConfig[]> {
    try {
      const query: Record<string, unknown> = {
        $or: [
          { userId: new Types.ObjectId(userId) },
          ...(includePublic
            ? [
                { 'permissions.viewRoles': userRole },
                { userId: { $exists: false } }, // Global dashboards
              ]
            : []),
        ],
        isActive: true,
      };

      if (category) {
        query['category'] = category;
      }

      const dashboards = await this.dashboardModel
        .find(query)
        .sort({ isDefault: -1, updatedAt: -1 })
        .limit(50);

      return dashboards.map((d) => this.mapToInterface(d));
    } catch (error) {
      this.logger.error('Failed to get dashboards:', error);
      throw error;
    }
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<CreateDashboardDto>,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      // Check permissions
      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to edit dashboard');
      }

      // Validate widgets if provided
      if (updates.widgets) {
        this.validateWidgets(updates.widgets);
        // Update widget IDs for new widgets
        updates.widgets = updates.widgets.map((widget) => ({
          ...widget,
          id:
            typeof widget.id === 'string' && widget.id.length > 0
              ? widget.id
              : new Types.ObjectId().toString(),
        }));
      }

      // Handle default dashboard logic
      if (updates.isDefault === true && dashboard.isDefault !== true) {
        await this.dashboardModel.updateMany(
          {
            userId: dashboard.userId,
            isDefault: true,
            _id: { $ne: dashboardId },
          },
          { $set: { isDefault: false } },
        );
      }

      // Update dashboard
      const updatedDashboard = await this.dashboardModel.findByIdAndUpdate(
        dashboardId,
        {
          ...updates,
          updatedBy: new Types.ObjectId(userId),
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedDashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      this.logger.log(`Dashboard updated: ${updatedDashboard.name} by user ${userId}`);

      // Emit event
      this.eventEmitter.emit('analytics.dashboard.updated', {
        dashboardId,
        userId,
        changes: Object.keys(updates),
      });

      return this.mapToInterface(updatedDashboard);
    } catch (error) {
      this.logger.error('Failed to update dashboard:', error);
      throw error;
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(dashboardId: string, userId: string, userRole: string): Promise<void> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      // Check permissions
      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to delete dashboard');
      }

      // Soft delete - mark as inactive
      await this.dashboardModel.updateOne(
        { _id: dashboardId },
        {
          $set: {
            isActive: false,
            updatedBy: new Types.ObjectId(userId),
            updatedAt: new Date(),
          },
        },
      );

      this.logger.log(`Dashboard deleted: ${dashboard.name} by user ${userId}`);

      // Emit event
      this.eventEmitter.emit('analytics.dashboard.deleted', {
        dashboardId,
        userId,
        dashboardName: dashboard.name,
      });
    } catch (error) {
      this.logger.error('Failed to delete dashboard:', error);
      throw error;
    }
  }

  // ==================== Widget Operations ====================

  /**
   * Add widget to dashboard
   */
  async addWidget(
    dashboardId: string,
    widget: CreateWidgetDto,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to edit dashboard');
      }

      // Validate widget limit
      if (dashboard.widgets.length >= 20) {
        throw new BadRequestException('Maximum of 20 widgets per dashboard allowed');
      }

      // Validate widget position
      this.validateWidgetPosition(widget.position, dashboard.widgets);

      const newWidget = {
        ...widget,
        id: new Types.ObjectId().toString(),
      };

      const updatedDashboard = await this.dashboardModel.findByIdAndUpdate(
        dashboardId,
        {
          $push: { widgets: newWidget },
          $set: {
            updatedBy: new Types.ObjectId(userId),
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!updatedDashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      // Emit event
      this.eventEmitter.emit('analytics.widget.added', {
        dashboardId,
        widgetId: newWidget.id,
        userId,
      });

      return this.mapToInterface(updatedDashboard);
    } catch (error) {
      this.logger.error('Failed to add widget:', error);
      throw error;
    }
  }

  /**
   * Update widget in dashboard
   */
  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<CreateWidgetDto>,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to edit dashboard');
      }

      const widgetIndex = dashboard.widgets.findIndex((w) => w.id === widgetId);
      if (widgetIndex === -1) {
        throw new NotFoundException('Widget not found');
      }

      const existingWidget = dashboard.widgets[widgetIndex];
      if (!existingWidget) {
        throw new NotFoundException('Widget not found');
      }

      // Update the widget
      const updatedWidget = {
        ...existingWidget,
        ...updates,
        id: widgetId, // Preserve ID
      };

      dashboard.widgets[widgetIndex] = updatedWidget;

      const updatedDashboard = await dashboard.save();

      // Emit event
      this.eventEmitter.emit('analytics.widget.updated', {
        dashboardId,
        widgetId,
        userId,
      });

      return this.mapToInterface(updatedDashboard);
    } catch (error) {
      this.logger.error('Failed to update widget:', error);
      throw error;
    }
  }

  /**
   * Remove widget from dashboard
   */
  async removeWidget(
    dashboardId: string,
    widgetId: string,
    userId: string,
    userRole: string,
  ): Promise<IDashboardConfig> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to edit dashboard');
      }

      const updatedDashboard = await this.dashboardModel.findByIdAndUpdate(
        dashboardId,
        {
          $pull: { widgets: { id: widgetId } },
          $set: {
            updatedBy: new Types.ObjectId(userId),
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!updatedDashboard) {
        throw new NotFoundException('Widget not found');
      }

      // Emit event
      this.eventEmitter.emit('analytics.widget.removed', {
        dashboardId,
        widgetId,
        userId,
      });

      return this.mapToInterface(updatedDashboard);
    } catch (error) {
      this.logger.error('Failed to remove widget:', error);
      throw error;
    }
  }

  // ==================== Default Dashboards ====================

  /**
   * Get default dashboard for user
   */
  async getDefaultDashboard(userId: string, userRole: string): Promise<IDashboardConfig | null> {
    try {
      const dashboard = await this.dashboardModel.findOne({
        $or: [
          { userId: new Types.ObjectId(userId), isDefault: true },
          { userId: { $exists: false }, isDefault: true, 'permissions.viewRoles': userRole },
        ],
        isActive: true,
      });

      return dashboard ? this.mapToInterface(dashboard) : null;
    } catch (error) {
      this.logger.error('Failed to get default dashboard:', error);
      return null;
    }
  }

  /**
   * Set dashboard as default
   */
  async setDefaultDashboard(dashboardId: string, userId: string, userRole: string): Promise<void> {
    try {
      const dashboard = await this.dashboardModel.findById(dashboardId);

      if (!dashboard) {
        throw new NotFoundException('Dashboard not found');
      }

      if (!this.canEditDashboard(dashboard, userId, userRole)) {
        throw new ForbiddenException('Insufficient permissions to modify dashboard');
      }

      // Unset existing defaults
      await this.dashboardModel.updateMany(
        {
          userId: dashboard.userId ?? new Types.ObjectId(userId),
          isDefault: true,
        },
        { $set: { isDefault: false } },
      );

      // Set new default
      await this.dashboardModel.updateOne({ _id: dashboardId }, { $set: { isDefault: true } });

      this.logger.log(`Set default dashboard: ${dashboard.name} for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to set default dashboard:', error);
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  private validateWidgets(widgets: CreateWidgetDto[]): void {
    if (widgets.length === 0) {
      throw new BadRequestException('Dashboard must have at least one widget');
    }

    if (widgets.length > 20) {
      throw new BadRequestException('Dashboard cannot have more than 20 widgets');
    }

    // Check for position conflicts
    const positions = new Set<string>();
    for (const widget of widgets) {
      const posKey = `${widget.position.row}-${widget.position.column}`;
      if (positions.has(posKey)) {
        throw new BadRequestException(
          `Widget position conflict at row ${widget.position.row}, column ${widget.position.column}`,
        );
      }
      positions.add(posKey);

      // Validate position bounds
      if (widget.position.row < 1 || widget.position.column < 1) {
        throw new BadRequestException('Widget position must start from row 1, column 1');
      }

      if (widget.position.width < 1 || widget.position.width > 12) {
        throw new BadRequestException('Widget width must be between 1 and 12');
      }

      if (widget.position.height < 1 || widget.position.height > 6) {
        throw new BadRequestException('Widget height must be between 1 and 6');
      }
    }
  }

  private validateWidgetPosition(position: WidgetPosition, existingWidgets: Widget[]): void {
    // Check for conflicts with existing widgets
    for (const widget of existingWidgets) {
      if (widget.position.row === position.row && widget.position.column === position.column) {
        throw new BadRequestException(
          `Position conflict at row ${position.row}, column ${position.column}`,
        );
      }
    }
  }

  private canCreateDashboard(userRole: string): boolean {
    return ['admin', 'merchant'].includes(userRole);
  }

  private canViewDashboard(
    dashboard: DashboardConfigDocument,
    userId: string,
    userRole: string,
  ): boolean {
    // Owner can always view
    if (dashboard.userId?.toString() === userId) {
      return true;
    }

    // Admin can view all
    if (userRole === 'admin') {
      return true;
    }

    // Check view permissions
    if (dashboard.permissions?.viewRoles.includes(userRole) === true) {
      return true;
    }

    // Global dashboards without userId are public
    if (!dashboard.userId) {
      return true;
    }

    return false;
  }

  private canEditDashboard(
    dashboard: DashboardConfigDocument,
    userId: string,
    userRole: string,
  ): boolean {
    // Owner can always edit
    if (dashboard.userId?.toString() === userId) {
      return true;
    }

    // Admin can edit all
    if (userRole === 'admin') {
      return true;
    }

    // Check edit permissions
    return dashboard.permissions?.editRoles.includes(userRole) ?? false;
  }

  private mapToInterface(dashboard: DashboardConfigDocument): IDashboardConfig {
    return {
      id: dashboard._id?.toString() || '',
      name: dashboard.name,
      description: dashboard.description,
      category: dashboard.category,
      widgets: dashboard.widgets.map((w) => ({
        id: w.id,
        type: w.type,
        title: w.title,
        ...(w.description !== undefined ? { description: w.description } : {}),
        dataSource: w.dataSource,
        visualization: w.visualization,
        filters: w.filters,
        ...(w.refreshInterval !== undefined ? { refreshInterval: w.refreshInterval } : {}),
        position: w.position,
      })),
      isDefault: dashboard.isDefault,
      userId: dashboard.userId?.toString(),
      permissions: dashboard.permissions,
      createdAt: dashboard.createdAt ?? new Date(),
      updatedAt: dashboard.updatedAt ?? new Date(),
    };
  }

  // ==================== Dashboard Templates ====================

  /**
   * Create default dashboard templates
   */
  async createDefaultTemplates(): Promise<void> {
    try {
      const templates = this.getDefaultTemplates();

      for (const template of templates) {
        const existing = await this.dashboardModel.findOne({
          name: template.name,
          userId: { $exists: false },
        });

        if (!existing) {
          // Create actual dashboard configuration from template
          const dashboardConfig = this.templateToDashboardConfig(template);
          await this.dashboardModel.create(dashboardConfig);
          this.logger.log(`Created default template: ${template.name}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to create default templates:', error);
    }
  }

  private getDefaultTemplates(): DashboardTemplate[] {
    return [
      {
        id: 'business-overview-template',
        name: 'Business Overview',
        description: 'Key business metrics and performance indicators',
        category: 'business',
        preview: 'Revenue tracking, order metrics, and business KPIs dashboard',
        widgetCount: 6,
        requiredRole: 'merchant',
      },
      {
        id: 'sustainability-template',
        name: 'Sustainability Dashboard',
        description: 'Environmental impact and food waste reduction metrics',
        category: 'sustainability',
        preview: 'Food saved, carbon footprint, and environmental impact tracking',
        widgetCount: 5,
        requiredRole: 'merchant',
      },
      {
        id: 'operations-template',
        name: 'Operations Dashboard',
        description: 'Operational efficiency and establishment performance',
        category: 'operations',
        preview: 'Order processing, establishment metrics, and operational KPIs',
        widgetCount: 7,
        requiredRole: 'admin',
      },
      {
        id: 'customer-template',
        name: 'Customer Analytics',
        description: 'Customer behavior and engagement analytics',
        category: 'customer',
        preview: 'User growth, retention rates, and customer journey analysis',
        widgetCount: 6,
        requiredRole: 'admin',
      },
      {
        id: 'financial-template',
        name: 'Financial Dashboard',
        description: 'Financial performance and payment analytics',
        category: 'financial',
        preview: 'Revenue analysis, payment processing, and financial KPIs',
        widgetCount: 5,
        requiredRole: 'admin',
      },
    ];
  }

  private templateToDashboardConfig(template: DashboardTemplate): Partial<DashboardConfig> {
    // Create a system user ObjectId for templates (using a fixed ID for consistency)
    const systemUserId = new Types.ObjectId('000000000000000000000000');
    const requiredRole = template.requiredRole;
    if (!requiredRole) {
      throw new BadRequestException(`Template '${template.id}' is missing a required role`);
    }

    return {
      name: template.name,
      description: template.description,
      category: template.category,
      widgets: this.getTemplateWidgets(template.id, template.widgetCount),
      isDefault: false,
      permissions: {
        viewRoles: [requiredRole],
        editRoles: ['admin'],
      },
      createdBy: systemUserId,
      tags: ['template', template.category],
      version: 1,
      isActive: true,
      viewCount: 0,
    };
  }

  private getTemplateWidgets(templateId: string, widgetCount: number): Widget[] {
    const baseWidgets: Record<string, Widget[]> = {
      'business-overview-template': [
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'Total Revenue',
          description: 'Total revenue generated today',
          dataSource: 'revenue',
          visualization: { chartType: 'bar', colorScheme: ['#4f46e5'] },
          filters: { period: 'today' },
          refreshInterval: 300,
          position: { row: 1, column: 1, width: 3, height: 2 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'chart',
          title: 'Daily Orders',
          description: 'Order volume over time',
          dataSource: 'orders',
          visualization: { chartType: 'line', xAxis: 'date', yAxis: 'count' },
          filters: { period: 'week' },
          refreshInterval: 600,
          position: { row: 1, column: 4, width: 6, height: 3 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'Active Offers',
          description: 'Currently active food offers',
          dataSource: 'offers',
          visualization: { chartType: 'donut', colorScheme: ['#10b981'] },
          filters: { status: 'active' },
          refreshInterval: 300,
          position: { row: 1, column: 10, width: 3, height: 2 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'chart',
          title: 'Category Performance',
          description: 'Sales by food category',
          dataSource: 'categories',
          visualization: { chartType: 'pie', colorScheme: ['#f59e0b', '#ef4444', '#8b5cf6'] },
          filters: { period: 'month' },
          refreshInterval: 1440,
          position: { row: 4, column: 1, width: 6, height: 3 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'table',
          title: 'Recent Orders',
          description: 'Latest customer orders',
          dataSource: 'recent_orders',
          visualization: { displayOptions: { pageSize: 10 } },
          filters: { limit: 10 },
          refreshInterval: 60,
          position: { row: 4, column: 7, width: 6, height: 3 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'Customer Satisfaction',
          description: 'Average rating from reviews',
          dataSource: 'reviews',
          visualization: { chartType: 'bar', colorScheme: ['#06b6d4'] },
          filters: { period: 'month' },
          refreshInterval: 1440,
          position: { row: 7, column: 1, width: 4, height: 2 },
        },
      ],
      'sustainability-template': [
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'Food Saved (kg)',
          description: 'Total food rescued from waste',
          dataSource: 'food_saved',
          visualization: { chartType: 'bar', colorScheme: ['#10b981'] },
          filters: { period: 'today' },
          refreshInterval: 300,
          position: { row: 1, column: 1, width: 4, height: 2 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'CO2 Saved',
          description: 'Carbon footprint reduction in kg CO2',
          dataSource: 'carbon_saved',
          visualization: { chartType: 'area', colorScheme: ['#059669'] },
          filters: { period: 'week' },
          refreshInterval: 600,
          position: { row: 1, column: 5, width: 4, height: 2 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'metric',
          title: 'Waste Reduction',
          description: 'Percentage waste reduction this month',
          dataSource: 'waste_reduction',
          visualization: { chartType: 'donut', colorScheme: ['#065f46'] },
          filters: { period: 'month' },
          refreshInterval: 1440,
          position: { row: 1, column: 9, width: 4, height: 2 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'chart',
          title: 'Environmental Impact Timeline',
          description: 'Track environmental benefits over time',
          dataSource: 'environmental_impact',
          visualization: { chartType: 'line', xAxis: 'date', yAxis: 'impact_score' },
          filters: { period: 'quarter' },
          refreshInterval: 1440,
          position: { row: 3, column: 1, width: 8, height: 3 },
        },
        {
          id: new Types.ObjectId().toString(),
          type: 'heatmap',
          title: 'Rescue Activity Map',
          description: 'Geographic distribution of food rescue activities',
          dataSource: 'rescue_locations',
          visualization: { displayOptions: { zoomLevel: 10 } },
          filters: { period: 'week' },
          refreshInterval: 1440,
          position: { row: 3, column: 9, width: 4, height: 3 },
        },
      ],
    };

    // Get widgets for the specific template, or create generic ones
    const widgets = baseWidgets[templateId] ?? this.createGenericWidgets(widgetCount);

    // Return only the requested number of widgets
    return widgets.slice(0, widgetCount);
  }

  private createGenericWidgets(count: number): Widget[] {
    const widgets: Widget[] = [];
    const widgetTypes: Array<'metric' | 'chart' | 'table'> = ['metric', 'chart', 'table'];

    for (let i = 0; i < count; i++) {
      const type = widgetTypes[i % widgetTypes.length] ?? 'metric';
      const row = Math.floor(i / 3) * 3 + 1;
      const column = (i % 3) * 4 + 1;

      widgets.push({
        id: new Types.ObjectId().toString(),
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Widget ${i + 1}`,
        description: `Sample ${type} widget for template`,
        dataSource: 'sample_data',
        visualization: {
          chartType: type === 'chart' ? 'bar' : undefined,
          colorScheme: ['#6366f1'],
        },
        filters: { period: 'day' },
        refreshInterval: 300,
        position: { row, column, width: 4, height: 2 },
      });
    }

    return widgets;
  }
}
