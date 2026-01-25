import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Body,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user.enum';
import { AuthUser } from '../common/decorators/get-user.decorator';
import { UsersService } from '../users/user.service';
import { AuthSecurityService } from './services/auth-security.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: AuthUser;
}

interface UnlockAccountDto {
  reason?: string;
}

interface SecurityStatsDto {
  fromDate?: string;
  toDate?: string;
}

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('auth/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSecurityService: AuthSecurityService,
  ) {}

  @ApiOperation({ summary: 'Unlock a locked user account', description: 'Admin endpoint to unlock user accounts that have been locked due to failed login attempts' })
  @ApiParam({ name: 'userId', description: 'MongoDB ObjectId of the user to unlock' })
  @ApiResponse({ status: 200, description: 'Account unlocked successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Post('unlock-account/:userId')
  @HttpCode(HttpStatus.OK)
  async unlockAccount(
    @Param('userId') userId: string,
    @Body() unlockDto: UnlockAccountDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const auditData = {
      ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    };

    // Get user email for clearing Redis attempts
    const user = await this.usersService.findById(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Clear Redis login attempts (single source of truth for blocking)
    await this.authSecurityService.clearLoginAttempts('*', user.email);

    // Also unlock in MongoDB for audit trail
    await this.usersService.unlockAccount(userId, req.user.userId, auditData);

    return {
      success: true,
      message: 'Account unlocked successfully',
      unlockedBy: req.user.userId,
      reason: unlockDto.reason || 'Admin action',
    };
  }

  @ApiOperation({ summary: 'Get list of locked accounts', description: 'Retrieve paginated list of all currently locked user accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Locked accounts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Get('locked-accounts')
  async getLockedAccounts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const currentDate = new Date();

    // Find locked accounts using direct MongoDB query
    const lockedAccounts = await this.usersService['userModel']
      .find({
        deletedAt: null,
        accountLockedUntil: { $gt: currentDate }
      })
      .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
      .skip(skip)
      .limit(limit)
      .sort({ accountLockedUntil: -1 })
      .exec();

    const totalLocked = await this.usersService['userModel']
      .countDocuments({
        deletedAt: null,
        accountLockedUntil: { $gt: currentDate }
      });

    return {
      success: true,
      data: {
        accounts: lockedAccounts,
        total: totalLocked,
        page,
        limit
      },
    };
  }

  @ApiOperation({ summary: 'Get authentication security statistics', description: 'Retrieve authentication statistics including successful/failed logins within a date range' })
  @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'Start date (ISO 8601 format, default: 7 days ago)' })
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'End date (ISO 8601 format, default: now)' })
  @ApiResponse({ status: 200, description: 'Security statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Get('security-stats')
  async getSecurityStats(@Query() query: SecurityStatsDto) {
    const stats = await this.getAuthenticationStats(query);

    return {
      success: true,
      data: stats,
    };
  }

  @ApiOperation({ summary: 'Clear all IP blocks and login attempts', description: 'Admin endpoint to clear all IP blocks and failed login attempt counters from Redis' })
  @ApiResponse({ status: 200, description: 'Security blocks cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Post('clear-ip-blocks')
  @HttpCode(HttpStatus.OK)
  async clearIpBlocks(@Request() req: AuthenticatedRequest) {
    const ipBlocksResult = await this.authSecurityService.clearAllIpBlocks();
    const attemptsResult = await this.authSecurityService.clearAllLoginAttempts();

    return {
      success: true,
      message: 'Security blocks cleared successfully',
      data: {
        clearedIpBlocks: ipBlocksResult.clearedCount,
        clearedLoginAttempts: attemptsResult.clearedCount,
      },
      clearedBy: req.user.userId,
    };
  }

  @ApiOperation({ summary: 'Get failed login attempts for a user', description: 'Retrieve failed login attempt count and lock status for a specific user' })
  @ApiParam({ name: 'userId', description: 'MongoDB ObjectId of the user' })
  @ApiResponse({ status: 200, description: 'Failed login attempts retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Get('failed-login-attempts/:userId')
  async getFailedLoginAttempts(@Param('userId') userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    return {
      success: true,
      data: {
        userId,
        failedAttempts: user.failedLoginAttempts || 0,
        accountLockedUntil: user.accountLockedUntil,
        isLocked: user.accountLockedUntil && user.accountLockedUntil > new Date(),
      },
    };
  }

  private async getAuthenticationStats(query: SecurityStatsDto) {
    const fromDate = query.fromDate ? new Date(query.fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = query.toDate ? new Date(query.toDate) : new Date();

    // Get authentication statistics
    const stats = await this.usersService.getAuthenticationStats(fromDate, toDate);

    return {
      period: {
        from: fromDate,
        to: toDate,
      },
      ...stats,
      summary: {
        totalLoginAttempts: (stats.successfulLogins || 0) + (stats.failedLogins || 0),
        successRate: stats.successfulLogins && stats.failedLogins
          ? ((stats.successfulLogins / (stats.successfulLogins + stats.failedLogins)) * 100).toFixed(2)
          : '0.00',
      },
    };
  }
}