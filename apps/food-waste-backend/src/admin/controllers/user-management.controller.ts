import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IUser } from '../../common/interfaces/user.interface';
import { IpAddress, UserAgent } from '../decorators';
import { UpdateUserStatusDto, BulkUserActionDto, UserSearchDto } from '../dto/user-management.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import {
  UserManagementService,
  UserListResponse,
  UserOverview,
  BulkActionResult,
  UserActivityData,
} from '../services/user-management.service';

@ApiTags('Admin User Management')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class UserManagementController {
  private readonly logger = new Logger(UserManagementController.name);

  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get user overview',
    description: 'Get overview statistics and metrics for all users',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User overview retrieved successfully',
  })
  async getUserOverview(): Promise<UserOverview> {
    const result = await this.userManagementService.getUserOverview();
    return result;
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users',
    description: 'Search and filter users with pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name or email' })
  @ApiQuery({ name: 'role', required: false, enum: ['consumer', 'merchant', 'admin'] })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'active', 'suspended', 'blocked'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchUsers(@Query() query: UserSearchDto): Promise<UserListResponse> {
    const result = await this.userManagementService.searchUsers(query);
    return result;
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve detailed information about a specific user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserById(@Param('userId') userId: string): Promise<IUser> {
    const result = await this.userManagementService.getUserById(userId);
    return result;
  }

  @Patch(':userId/status')
  @ApiOperation({
    summary: 'Update user status',
    description: 'Update the status of a specific user (suspend, activate, block, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() updateDto: UpdateUserStatusDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IUser> {
    const admin = req.user;

    const result = await this.userManagementService.updateUserStatus(
      userId,
      updateDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Post('bulk-action')
  @ApiOperation({
    summary: 'Perform bulk user actions',
    description: 'Perform bulk actions on multiple users (bulk suspend, activate, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk action completed',
  })
  async bulkUserAction(
    @Body() bulkActionDto: BulkUserActionDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<BulkActionResult> {
    const admin = req.user;

    this.logger.log(
      `Admin ${admin.email} initiating bulk action: ${bulkActionDto.status} on ${bulkActionDto.userIds.length} users`,
    );

    const result = await this.userManagementService.bulkUpdateUserStatus(
      bulkActionDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Delete(':userId')
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete a user (soft delete by default, hard delete with query parameter)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'hard',
    required: false,
    type: Boolean,
    description: 'Perform hard delete (permanent)',
  })
  @ApiQuery({ name: 'reason', required: true, type: String, description: 'Reason for deletion' })
  async deleteUser(
    @Param('userId') userId: string,
    @Query('reason') reason: string,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
    @Query('hard') hardDelete: boolean = false,
  ): Promise<{ success: boolean }> {
    const admin = req.user;

    const result = await this.userManagementService.deleteUser(
      userId,
      reason,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
      hardDelete,
    );

    return { success: result };
  }

  @Get(':userId/activity')
  @ApiOperation({
    summary: 'Get user activity',
    description: 'Get activity history for a specific user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activity retrieved successfully',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default: 30)',
  })
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('days') days: number = 30,
  ): Promise<UserActivityData> {
    const result = await this.userManagementService.getUserActivity(userId, days);
    return result;
  }
}
