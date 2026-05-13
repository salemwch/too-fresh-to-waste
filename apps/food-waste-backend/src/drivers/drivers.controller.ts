import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { DriversService } from './drivers.service';
import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';
import { UnassignOrderDto } from './dto/unassign-order.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('orders/available')
  async getAvailableOrders(@Query() query: AvailableOrdersQueryDto) {
    const result = await this.driversService.getAvailableOrders(query);
    return result;
  }

  @Post('orders/:id/accept')
  async acceptOrder(@Param('id') orderId: string, @GetUser('id') driverId: string) {
    const result = await this.driversService.acceptOrder(orderId, driverId);
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
    @Body() _body: UnassignOrderDto,
  ) {
    const result = await this.driversService.unassignOrder(orderId, driverId);
    return result;
  }
}
