import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { DriverOrdersQueryDto } from '../dto/driver-orders-query.dto';
import { DriverManagementService } from '../services/driver-management.service';

@ApiTags('Admin Drivers')
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class AdminDriversController {
  constructor(private readonly driverManagementService: DriverManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create driver account',
    description: 'Create a new driver user account with associated driver profile',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Driver account created successfully',
  })
  async createDriver(@Body() dto: CreateDriverDto) {
    const result = await this.driverManagementService.createDriver(dto);
    return {
      status: 'success',
      message: 'Driver account created',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all drivers',
    description:
      'List every driver with their profile, live availability and lifetime delivery stats',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Drivers retrieved successfully' })
  async getDrivers() {
    const drivers = await this.driverManagementService.getDrivers();
    return {
      status: 'success',
      message: 'Drivers retrieved',
      data: drivers,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get driver detail',
    description:
      'Full dossier for one driver: profile, last known position, lifetime stats, ' +
      'earnings buckets and the unassignment trail',
  })
  @ApiParam({ name: 'id', description: 'Driver user id' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Driver retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Driver not found' })
  async getDriverDetail(@Param('id') id: string) {
    const detail = await this.driverManagementService.getDriverDetail(id);
    return {
      status: 'success',
      message: 'Driver retrieved',
      data: detail,
    };
  }

  @Get(':id/orders')
  @ApiOperation({
    summary: 'Get driver order history',
    description: 'Paginated list of every order this driver has held, newest first',
  })
  @ApiParam({ name: 'id', description: 'Driver user id' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orders retrieved successfully' })
  async getDriverOrders(@Param('id') id: string, @Query() query: DriverOrdersQueryDto) {
    const result = await this.driverManagementService.getDriverOrders(id, query);
    return {
      status: 'success',
      message: 'Driver orders retrieved',
      data: result.orders,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }
}
