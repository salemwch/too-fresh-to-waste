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
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AuthUser } from './decorators/get-user.decorator';
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

@Controller('auth/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSecurityService: AuthSecurityService,
  ) {}

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

    await this.usersService.unlockAccount(userId, req.user.userId, auditData);

    return {
      success: true,
      message: 'Account unlocked successfully',
      unlockedBy: req.user.userId,
      reason: unlockDto.reason || 'Admin action',
    };
  }

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

  @Get('security-stats')
  async getSecurityStats(@Query() query: SecurityStatsDto) {
    const stats = await this.getAuthenticationStats(query);

    return {
      success: true,
      data: stats,
    };
  }

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