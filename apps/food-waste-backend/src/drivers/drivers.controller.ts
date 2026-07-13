import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { DriversService } from './drivers.service';
import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { UnassignOrderDto } from './dto/unassign-order.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';
import { UpdateOnlineStatusDto } from './dto/update-online-status.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  // ── Availability ──────────────────────────────────────────────────────────

  @Get('me')
  async getProfile(@GetUser('id') driverId: string) {
    const result = await this.driversService.getProfile(driverId);
    return result;
  }

  @Patch('status')
  async setOnlineStatus(@GetUser('id') driverId: string, @Body() dto: UpdateOnlineStatusDto) {
    const result = await this.driversService.setOnlineStatus(driverId, dto.isOnline);
    return result;
  }

  /**
   * Location heartbeat. 204 rather than echoing the profile back — the app
   * calls this on a timer and has no use for the response body.
   */
  @Post('location')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateLocation(
    @GetUser('id') driverId: string,
    @Body() dto: UpdateDriverLocationDto,
  ): Promise<void> {
    await this.driversService.updateLocation(driverId, dto.lat, dto.lng);
  }

  // ── Order pool ────────────────────────────────────────────────────────────

  @Get('orders/available')
  async getAvailableOrders(
    @Query() query: AvailableOrdersQueryDto,
    @GetUser('id') driverId: string,
  ) {
    const result = await this.driversService.getAvailableOrders(query, driverId);
    return result;
  }

  /** Declared before ':id' routes so 'active' is not swallowed as an order id. */
  @Get('orders/active')
  async getActiveOrder(@GetUser('id') driverId: string) {
    const result = await this.driversService.getActiveOrder(driverId);
    return result;
  }

  @Get('orders/history')
  async getOrderHistory(@GetUser('id') driverId: string, @Query() query: OrderHistoryQueryDto) {
    const result = await this.driversService.getOrderHistory(driverId, query);
    return result;
  }

  @Get('earnings')
  async getEarnings(@GetUser('id') driverId: string) {
    const result = await this.driversService.getEarningsSummary(driverId);
    return result;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @Post('orders/:id/accept')
  async acceptOrder(@Param('id') orderId: string, @GetUser('id') driverId: string) {
    const result = await this.driversService.acceptOrder(orderId, driverId);
    return result;
  }

  @Post('orders/:id/pickup')
  async markPickedUp(@Param('id') orderId: string, @GetUser('id') driverId: string) {
    const result = await this.driversService.markPickedUp(orderId, driverId);
    return result;
  }

  @Post('orders/:id/deliver')
  async markDelivered(@Param('id') orderId: string, @GetUser('id') driverId: string) {
    const result = await this.driversService.markDelivered(orderId, driverId);
    return result;
  }

  @Post('orders/:id/unassign')
  async unassignOrder(
    @Param('id') orderId: string,
    @GetUser('id') driverId: string,
    @Body() dto: UnassignOrderDto,
  ) {
    const result = await this.driversService.unassignOrder(orderId, driverId, dto.reason);
    return result;
  }
}
