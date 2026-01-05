import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { GamificationService } from './services/gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../users/schemas/user.schema';
import {
  CreateLoyaltyAccountDto,
  AddPointsDto,
  LoyaltyStatsDto,
  DonatePointsDto,
  DonatePointsResponseDto,
} from './dto/loyalty-account.dto';

/**
 * LoyaltyController
 * Handles loyalty program endpoints including points, badges, tiers, donations, and gamification
 */
@ApiTags('Loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly gamificationService: GamificationService,
  ) {}

  // =============================================================================
  // CORE LOYALTY ENDPOINTS
  // =============================================================================

  @Post('account')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create loyalty account' })
  @ApiResponse({ status: 201, description: 'Loyalty account created successfully' })
  @ApiResponse({ status: 400, description: 'Account already exists' })
  createAccount(@Body() createDto: CreateLoyaltyAccountDto, @GetUser('id') userId: string) {
    createDto.userId = userId;
    return this.loyaltyService.createLoyaltyAccount(createDto);
  }

  @Get('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user loyalty account' })
  @ApiResponse({ status: 200, description: 'Loyalty account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  getAccount(@GetUser('id') userId: string) {
    return this.loyaltyService.getLoyaltyAccount(userId);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get loyalty statistics' })
  @ApiResponse({ status: 200, description: 'Loyalty statistics retrieved successfully' })
  async getStats(@GetUser('id') userId: string): Promise<LoyaltyStatsDto> {
    const account = await this.loyaltyService.getLoyaltyAccount(userId);

    return {
      totalPoints: account.totalPoints,
      availablePoints: account.availablePoints,
      lifetimePointsEarned: account.lifetimePointsEarned,
      totalOrdersCount: account.totalOrdersCount,
      totalAmountSpent: account.totalAmountSpent,
      currentTier: account.currentTier,
      badgeCount: account.badges.length,
      referralCount: account.referralCount,
      joinedAt: account.joinedAt,
      lastActivity: account.lastActivity,
    };
  }

  @Post('points/add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add points to user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'Points added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  addPoints(
    @Param('userId') userId: string,
    @Body() addPointsDto: AddPointsDto,
  ) {
    return this.loyaltyService.addPoints(userId, addPointsDto);
  }

  // =============================================================================
  // DONATION ENDPOINTS
  // =============================================================================

  @Post('donate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Donate points to community food relief',
    description: 'Convert loyalty points to TND and donate to the community food relief pool. 500 points = 5 TND.',
  })
  @ApiResponse({
    status: 200,
    description: 'Points donated successfully',
    type: DonatePointsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Insufficient points' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  donatePoints(
    @GetUser('id') userId: string,
    @Body() donateDto: DonatePointsDto,
  ): Promise<DonatePointsResponseDto> {
    return this.loyaltyService.donatePoints(userId, donateDto);
  }

  @Get('donations/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user donation history',
    description: 'Retrieve the history of points donated by the user to community food relief',
  })
  @ApiResponse({ status: 200, description: 'Donation history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  getDonationHistory(@GetUser('id') userId: string) {
    return this.loyaltyService.getDonationHistory(userId);
  }

  // =============================================================================
  // GAMIFICATION: REFERRAL CODE
  // =============================================================================

  @Get('referral-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get or generate referral code',
    description: 'Get the user\'s unique referral code for sharing with friends and businesses',
  })
  @ApiResponse({ status: 200, description: 'Referral code retrieved successfully' })
  async getReferralCode(@GetUser('id') userId: string) {
    const code = await this.gamificationService.getReferralCode(userId);
    return { referralCode: code };
  }

  // =============================================================================
  // GAMIFICATION: STATS
  // =============================================================================

  @Get('gamification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get gamification progress',
    description: 'Get user\'s progress on all gamification features: referrals, streaks, reviews',
  })
  @ApiResponse({ status: 200, description: 'Gamification stats retrieved successfully' })
  getGamificationStats(@GetUser('id') userId: string) {
    return this.gamificationService.getGamificationStats(userId);
  }

  // =============================================================================
  // GAMIFICATION: LOGIN STREAK (called by auth service, but can also check manually)
  // =============================================================================

  @Post('login-streak')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record daily login for streak',
    description: 'Record a login for daily streak tracking. Awards 2 pts/day for 10-day streaks (max 20 pts/month)',
  })
  @ApiResponse({ status: 200, description: 'Login recorded' })
  async recordLogin(@GetUser('id') userId: string) {
    const result = await this.gamificationService.recordDailyLogin(userId);
    return {
      streakDays: result.streakDays,
      pointsAwarded: result.pointsAwarded,
      message: result.pointsAwarded > 0
        ? `Day ${result.streakDays} streak! +${result.pointsAwarded} points`
        : `Day ${result.streakDays} streak (already logged in today or max reached)`,
    };
  }
}
