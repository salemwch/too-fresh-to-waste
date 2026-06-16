import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

import {
  CreateLoyaltyAccountDto,
  AddPointsDto,
  DonatePointsDto,
  DonatePointsResponseDto,
  UpdateLeaderboardConsentDto,
} from './dto/loyalty-account.dto';
import { ClaimDiscountDto } from './dto/prize-claim.dto';
import { LoyaltyService } from './loyalty.service';
import { GamificationService } from './services/gamification.service';
import { PrizeClaimService } from './services/prize-claim.service';

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
    private readonly prizeClaimService: PrizeClaimService,
  ) {}

  // =============================================================================
  // CORE LOYALTY ENDPOINTS
  // =============================================================================

  @Post('account')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create loyalty account' })
  @ApiResponse({ status: 201, description: 'Loyalty account created successfully' })
  @ApiResponse({ status: 400, description: 'Account already exists' })
  async createAccount(@Body() createDto: CreateLoyaltyAccountDto, @GetUser('id') userId: string) {
    createDto.userId = userId;
    const account = await this.loyaltyService.createLoyaltyAccount(createDto);
    return { message: 'Loyalty account created successfully', data: account };
  }

  @Get('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user loyalty account' })
  @ApiResponse({ status: 200, description: 'Loyalty account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  async getAccount(@GetUser('id') userId: string) {
    const account = await this.loyaltyService.getLoyaltyAccountWithBagCount(userId);
    return { message: 'Loyalty account retrieved successfully', data: account };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get loyalty statistics' })
  @ApiResponse({ status: 200, description: 'Loyalty statistics retrieved successfully' })
  async getStats(@GetUser('id') userId: string) {
    const stats = await this.loyaltyService.getLoyaltyStats(userId);
    return { message: 'Loyalty statistics retrieved successfully', data: stats };
  }

  @Post('points/add')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add points to user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'Points added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async addPoints(@Param('userId') userId: string, @Body() addPointsDto: AddPointsDto) {
    const result = await this.loyaltyService.addPoints(userId, addPointsDto);
    return result;
  }

  // =============================================================================
  // DONATION ENDPOINTS
  // =============================================================================

  @Post('donate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Donate points to community food relief',
    description:
      'Convert loyalty points to TND and donate to the community food relief pool. 500 points = 5 TND.',
  })
  @ApiResponse({
    status: 200,
    description: 'Points donated successfully',
    type: DonatePointsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Insufficient points' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  async donatePoints(
    @GetUser('id') userId: string,
    @Body() donateDto: DonatePointsDto,
  ): Promise<DonatePointsResponseDto> {
    const result = await this.loyaltyService.donatePoints(userId, donateDto);
    return result;
  }

  @Get('donations/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user donation history',
    description: 'Retrieve the history of points donated by the user to community food relief',
  })
  @ApiResponse({ status: 200, description: 'Donation history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Loyalty account not found' })
  async getDonationHistory(@GetUser('id') userId: string) {
    const history = await this.loyaltyService.getDonationHistory(userId);
    return { message: 'Donation history retrieved successfully', data: history };
  }

  // =============================================================================
  // GAMIFICATION: REFERRAL CODE
  // =============================================================================

  @Get('referral-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get or generate referral code',
    description: "Get the user's unique referral code for sharing with friends and businesses",
  })
  @ApiResponse({ status: 200, description: 'Referral code retrieved successfully' })
  async getReferralCode(@GetUser('id') userId: string) {
    const code = await this.gamificationService.getReferralCode(userId);
    return { message: 'Referral code retrieved successfully', data: { referralCode: code } };
  }

  @Get('referral-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full referral link for sharing',
    description: "Returns the user's referral link URL for sharing with friends and businesses",
  })
  @ApiResponse({ status: 200, description: 'Referral link retrieved successfully' })
  async getReferralLink(@GetUser('id') userId: string) {
    const code = await this.gamificationService.getReferralCode(userId);
    const baseUrl = 'https://toofreshtowaste.com';
    const referralLink = `${baseUrl}/r/${code}`;
    return {
      message: 'Referral link retrieved successfully',
      data: { referralCode: code, referralLink },
    };
  }

  // =============================================================================
  // GAMIFICATION: STATS
  // =============================================================================

  @Get('gamification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get gamification progress',
    description: "Get user's progress on all gamification features: referrals, streaks, reviews",
  })
  @ApiResponse({ status: 200, description: 'Gamification stats retrieved successfully' })
  async getGamificationStats(@GetUser('id') userId: string) {
    const stats = await this.gamificationService.getGamificationStats(userId);
    return { message: 'Gamification stats retrieved successfully', data: stats };
  }

  // =============================================================================
  // GAMIFICATION: LOGIN STREAK (called by auth service, but can also check manually)
  // =============================================================================

  @Post('login-streak')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record daily login for streak',
    description:
      'Record a login for daily streak tracking. Awards 2 pts/day for 10-day streaks (max 20 pts/month)',
  })
  @ApiResponse({ status: 200, description: 'Login recorded' })
  async recordLogin(@GetUser('id') userId: string) {
    const result = await this.gamificationService.recordDailyLogin(userId);
    return {
      streakDays: result.streakDays,
      pointsAwarded: result.pointsAwarded,
      message:
        result.pointsAwarded > 0
          ? `Day ${result.streakDays} streak! +${result.pointsAwarded} points`
          : `Day ${result.streakDays} streak (already logged in today or max reached)`,
    };
  }

  // =============================================================================
  // LEADERBOARD
  // =============================================================================

  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get loyalty leaderboard',
    description:
      "Returns top users ranked by total loyalty points. Also returns the calling user's entry when they fall outside the top N.",
  })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(
    @GetUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100) : 50;
    const parsedOffset = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;
    const data = await this.loyaltyService.getLeaderboard(userId, parsedLimit, parsedOffset);
    return { message: 'Leaderboard retrieved successfully', data };
  }

  // =============================================================================
  // LEADERBOARD CONSENT
  // =============================================================================

  @Patch('leaderboard-consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set leaderboard display preference',
    description:
      'Save whether the user wants to appear with their real name/photo or as Anonymous. ' +
      'Must be called at least once before the user appears in the leaderboard.',
  })
  @ApiResponse({ status: 200, description: 'Leaderboard consent saved successfully' })
  async updateLeaderboardConsent(
    @GetUser('id') userId: string,
    @Body() dto: UpdateLeaderboardConsentDto,
  ) {
    await this.loyaltyService.updateLeaderboardConsent(userId, dto.showRealName);
    return {
      message: 'Leaderboard consent saved successfully',
      data: { showRealName: dto.showRealName },
    };
  }

  // =============================================================================
  // PRIZE CLAIMS
  // =============================================================================

  @Get('prize-claim/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get prize claim status',
    description:
      'Check whether the user is eligible to claim a prize and whether they already have.',
  })
  @ApiResponse({ status: 200, description: 'Prize claim status retrieved' })
  async getPrizeClaimStatus(@GetUser('id') userId: string) {
    const data = await this.prizeClaimService.getClaimStatus(userId);
    return { message: 'Prize claim status retrieved', data };
  }

  @Post('prize-claim/smartphone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Claim smartphone prize (top 5 only)',
    description: 'Top 5 leaderboard users claim their smartphone. Triggers admin notification.',
  })
  @ApiResponse({ status: 201, description: 'Smartphone prize claimed' })
  @ApiResponse({ status: 400, description: 'Not eligible or challenge not ended' })
  @ApiResponse({ status: 409, description: 'Already claimed' })
  async claimSmartphone(@GetUser('id') userId: string) {
    const data = await this.prizeClaimService.claimSmartphone(userId);
    return { message: 'Smartphone prize claimed successfully', data };
  }

  @Post('prize-claim/discount')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Claim discount prize (rank 6+)',
    description: 'Rank 6+ users choose a partner business to receive their 10% discount from.',
  })
  @ApiResponse({ status: 201, description: 'Discount prize claimed' })
  @ApiResponse({ status: 400, description: 'Not eligible or challenge not ended' })
  @ApiResponse({ status: 409, description: 'Already claimed' })
  async claimDiscount(@GetUser('id') userId: string, @Body() dto: ClaimDiscountDto) {
    const data = await this.prizeClaimService.claimDiscount(userId, dto.establishmentId);
    return { message: 'Discount prize claimed successfully', data };
  }
}
