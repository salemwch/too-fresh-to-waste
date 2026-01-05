import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../users/schemas/user.schema';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  StockUpdateDto,
  ReserveStockDto,
  ReleaseStockDto,
  BulkUpdateStockDto,
  InventoryFiltersDto,
  AcknowledgeAlertDto,
} from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create inventory item' })
  @ApiResponse({ status: 201, description: 'Inventory item created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
   createInventoryItem(
    @Body() createDto: CreateInventoryItemDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.createInventoryItem(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get inventory items with filters' })
  @ApiResponse({ status: 200, description: 'Inventory items retrieved successfully' })
   getInventoryItems(@Query() filters: InventoryFiltersDto) {
    return this.inventoryService.getInventoryItems(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   getInventoryItem(@Param('id') id: string) {
    return this.inventoryService.getInventoryItem(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update inventory item' })
  @ApiResponse({ status: 200, description: 'Inventory item updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   updateInventoryItem(
    @Param('id') _id: string,
    @Body() _updateDto: UpdateInventoryItemDto,
    @GetUser('id') _userId: string,
  ) {
    // Implementation would go in the service
    throw new Error('Update inventory item method not implemented');
  }

  @Patch(':id/stock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update stock quantity' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   updateStock(
    @Param('id') id: string,
    @Body() updateDto: StockUpdateDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.updateStock(id, updateDto, userId);
  }

  @Post(':id/reserve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reserve stock for order' })
  @ApiResponse({ status: 200, description: 'Stock reserved successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient available stock' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   reserveStock(
    @Param('id') id: string,
    @Body() reserveDto: ReserveStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.reserveStock(id, reserveDto, userId);
  }

  @Post(':id/release')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Release reserved stock' })
  @ApiResponse({ status: 200, description: 'Stock released successfully' })
  @ApiResponse({ status: 400, description: 'Cannot release more stock than reserved' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   releaseStock(
    @Param('id') id: string,
    @Body() releaseDto: ReleaseStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.releaseStock(id, releaseDto, userId);
  }

  @Post(':id/confirm-sale')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm sale and update stock' })
  @ApiResponse({ status: 200, description: 'Sale confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient reserved stock' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
   confirmSale(
    @Param('id') id: string,
    @Body() body: { quantity: number; orderId: string },
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.confirmSale(id, body.quantity, body.orderId, userId);
  }

  @Post('bulk-update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk update stock for multiple items' })
  @ApiResponse({ status: 200, description: 'Bulk update completed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
   bulkUpdateStock(
    @Body() bulkUpdateDto: BulkUpdateStockDto,
    @GetUser('id') userId: string,
  ) {
    return this.inventoryService.bulkUpdateStock(bulkUpdateDto, userId);
  }

  @Get('analytics/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get inventory analytics overview' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  @ApiQuery({ name: 'establishmentId', required: false })
   getInventoryAnalytics(@Query('establishmentId') establishmentId?: string) {
    return this.inventoryService.getInventoryAnalytics(establishmentId);
  }

  @Get('alerts/active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get active inventory alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  async getActiveAlerts(@Query('establishmentId') establishmentId?: string) {
    const filters: InventoryFiltersDto = {
      establishmentId,
      page: 1,
      limit: 100,
    };
    const result = await this.inventoryService.getInventoryItems(filters);

    // Extract items with unacknowledged alerts
    const itemsWithAlerts = result.items.filter(item =>
      item.alerts && item.alerts.some(alert => !alert.acknowledged)
    );

    return {
      alerts: itemsWithAlerts.flatMap(item =>
        item.alerts
          .filter(alert => !alert.acknowledged)
          .map(alert => ({
            ...alert,
            itemId: item._id,
            itemName: item.name,
            establishmentId: item.establishmentId,
          }))
      ),
      totalItems: itemsWithAlerts.length,
    };
  }

  @Post('alerts/:alertId/acknowledge')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Acknowledge inventory alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
   acknowledgeAlert(
    @Param('alertId') _alertId: string,
    @Body() _acknowledgeDto: AcknowledgeAlertDto,
    @GetUser('id') _userId: string,
  ) {
    // This would need to be implemented in the service to find and update specific alerts
    throw new Error('Acknowledge alert method not implemented');
  }

  @Get('reports/low-stock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get low stock report' })
  @ApiResponse({ status: 200, description: 'Low stock report generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
   getLowStockReport(@Query('establishmentId') establishmentId?: string) {
    const filters: InventoryFiltersDto = {
      establishmentId,
      lowStock: true,
      page: 1,
      limit: 100,
      sortBy: 'currentStock',
    };
    return this.inventoryService.getInventoryItems(filters);
  }

  @Get('reports/expiring')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get expiring items report' })
  @ApiResponse({ status: 200, description: 'Expiring items report generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days ahead to check (default: 3)' })
   getExpiringItemsReport(
    @Query('establishmentId') establishmentId?: string,
    @Query('days') days?: number,
  ) {
    const filters: InventoryFiltersDto = {
      establishmentId,
      expiringSoon: true,
      expiringInDays: days || 3,
      page: 1,
      limit: 100,
      sortBy: 'expiryDate',
    };
    return this.inventoryService.getInventoryItems(filters);
  }

  @Get(':id/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get stock movement history for item' })
  @ApiResponse({ status: 200, description: 'Stock history retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Establishment or Admin role required' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async getStockHistory(@Param('id') id: string) {
    const item = await this.inventoryService.getInventoryItem(id);
    return {
      itemId: item._id,
      itemName: item.name,
      stockHistory: item.stockHistory.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    };
  }
}