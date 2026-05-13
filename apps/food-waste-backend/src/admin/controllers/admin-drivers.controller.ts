import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { UserManagementService } from '../services/user-management.service';

@ApiTags('Admin Drivers')
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class AdminDriversController {
  constructor(private readonly userManagementService: UserManagementService) {}

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
    const result = await this.userManagementService.createDriver(dto);
    return {
      status: 'success',
      message: 'Driver account created',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all drivers',
    description: 'Retrieve a list of all driver accounts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Drivers retrieved successfully',
  })
  async getDrivers() {
    const drivers = await this.userManagementService.getDrivers();
    return {
      status: 'success',
      message: 'Drivers retrieved',
      data: drivers,
    };
  }
}
