import { UserRole } from '@foodwaste/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Patch,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProSubscriptionGuard } from '../../common/guards/pro-subscription.guard';
import { SkipProGuard } from '../../common/decorators/skip-pro-guard.decorator';
import { UpdateMonthlyGoalDto } from '../dto/sustainability.dto';
import type {
  CarbonMetricsResponse,
  EsgTierResponse,
  FundLedgerResponse,
  MonthlyGoalResponse,
  SocialImpactResponse,
  StreakResponse,
} from '../dto/sustainability.dto';
import { FundLedgerService } from '../services/fund-ledger.service';
import { PdfReportService } from '../services/pdf-report.service';
import { StreakService } from '../services/streak.service';
import { SustainabilityService } from '../services/sustainability.service';
import { strictValidation } from '../../common/pipes/validation-pipes';

import { appError } from '../../common/errors';
@ApiTags('Sustainability')
@ApiBearerAuth()
@Controller('sustainability')
@UseGuards(JwtAuthGuard, RolesGuard, ProSubscriptionGuard)
@Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
export class SustainabilityController {
  private readonly logger = new Logger(SustainabilityController.name);

  constructor(
    private readonly sustainabilityService: SustainabilityService,
    private readonly pdfReportService: PdfReportService,
    private readonly streakService: StreakService,
    private readonly fundLedgerService: FundLedgerService,
  ) {}

  @Get('tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant ESG tier and milestone progress' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'ESG tier data retrieved' })
  async getEsgTier(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: EsgTierResponse }> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.sustainabilityService.getEsgTier(
      req.user.userId,
      effectiveEstablishmentId,
    );
    return { message: 'ESG tier retrieved successfully', data };
  }

  @Get('monthly-goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant monthly bag-saving goal progress' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  async getMonthlyGoal(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: MonthlyGoalResponse }> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.sustainabilityService.getMonthlyGoal(
      req.user.userId,
      effectiveEstablishmentId,
    );
    return { message: 'Monthly goal retrieved successfully', data };
  }

  @Patch('monthly-goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update merchant monthly bag-saving goal' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  async updateMonthlyGoal(
    @Request() req: AuthenticatedRequest,
    @Body(strictValidation()) dto: UpdateMonthlyGoalDto,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: MonthlyGoalResponse }> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.sustainabilityService.updateMonthlyGoal(
      req.user.userId,
      dto.targetBagsPerMonth,
      effectiveEstablishmentId,
    );
    return { message: 'Monthly goal updated successfully', data };
  }

  @Get('carbon-metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get ADEME Scope 3 carbon impact metrics' })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO date string filter (e.g. 2025-01-01)',
  })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  async getCarbonMetrics(
    @Request() req: AuthenticatedRequest,
    @Query('since') since?: string,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: CarbonMetricsResponse }> {
    const startDate = since ? new Date(since) : undefined;
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.sustainabilityService.getCarbonMetrics(
      req.user.userId,
      startDate,
      effectiveEstablishmentId,
    );
    return { message: 'Carbon metrics retrieved successfully', data };
  }

  @Get('social-impact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get social impact (meals distributed, people served)' })
  @ApiQuery({ name: 'since', required: false, description: 'ISO date string filter' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  async getSocialImpact(
    @Request() req: AuthenticatedRequest,
    @Query('since') since?: string,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: SocialImpactResponse }> {
    const startDate = since ? new Date(since) : undefined;
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.sustainabilityService.getSocialImpact(
      req.user.userId,
      startDate,
      effectiveEstablishmentId,
    );
    return { message: 'Social impact retrieved successfully', data };
  }

  @Get('streak')
  @SkipProGuard()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant daily listing streak data' })
  async getStreak(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string; data: StreakResponse }> {
    const data = await this.streakService.getStreakData(req.user.userId);
    return { message: 'Streak data retrieved successfully', data };
  }

  @Get('fund-ledger')
  @SkipProGuard()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Community fund contribution generated by this merchant's sales" })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Fund ledger retrieved' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Location manager whose assigned establishment does not resolve to an owner',
  })
  async getFundLedger(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: FundLedgerResponse }> {
    /*
     * The ledger keys on `UserDonation.merchantId`, which is written from
     * `order.merchantId` = `establishment.ownerId`. A location manager's own
     * user id never appears there, so passing `req.user.userId` the way the
     * other handlers in this controller do would match zero donations and
     * render the "your first sale starts this" empty state to an
     * establishment that has been trading for months.
     *
     * So resolve the owner of the assigned establishment and read the ledger
     * as that merchant, still scoped to the assigned establishment - the
     * manager sees their own shop's contribution and nothing wider.
     */
    if (req.user.role === UserRole.LOCATION_MANAGER) {
      const assignedEstablishmentId = req.user.assignedEstablishmentId;
      const ownerId = assignedEstablishmentId
        ? await this.fundLedgerService.resolveEstablishmentOwnerId(assignedEstablishmentId)
        : null;

      if (!assignedEstablishmentId || !ownerId) {
        /*
         * Refuse rather than widen. Dropping the establishment scope here
         * would show the whole organisation's ledger; dropping the owner
         * lookup would show an empty ledger as though no sale had ever been
         * made. Neither is safe, and an unassigned or deleted establishment
         * is an account-setup problem, not a zero balance.
         */
        this.logger.warn(
          `Fund ledger denied for location manager ${req.user.userId}: assigned establishment ${assignedEstablishmentId ?? 'none'} did not resolve to an owner`,
        );
        throw new NotFoundException(appError('COMMUNITY_FUND_NO_ESTABLISHMENT'));
      }

      const data = await this.fundLedgerService.getFundLedger(ownerId, assignedEstablishmentId);
      return { message: 'Fund ledger retrieved successfully', data };
    }

    const data = await this.fundLedgerService.getFundLedger(req.user.userId, establishmentId);
    return { message: 'Fund ledger retrieved successfully', data };
  }

  @Get('reports/carbon-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download ESG Carbon Balance PDF report (ISO 14001 format)' })
  @ApiQuery({ name: 'establishmentId', required: false, description: 'Filter by establishment' })
  @ApiResponse({ status: HttpStatus.OK, description: 'PDF binary stream' })
  async downloadCarbonBalanceReport(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;

    this.logger.log(`Carbon balance PDF requested by merchant ${req.user.userId}`);

    const [tier, goal, carbon, social] = await Promise.all([
      this.sustainabilityService.getEsgTier(req.user.userId, effectiveEstablishmentId),
      this.sustainabilityService.getMonthlyGoal(req.user.userId, effectiveEstablishmentId),
      this.sustainabilityService.getCarbonMetrics(
        req.user.userId,
        undefined,
        effectiveEstablishmentId,
      ),
      this.sustainabilityService.getSocialImpact(
        req.user.userId,
        undefined,
        effectiveEstablishmentId,
      ),
    ]);

    const pdfBuffer = await this.pdfReportService.generateCarbonBalanceReport({
      merchantName: req.user.email,
      tier,
      goal,
      carbon,
      social,
      generatedAt: new Date(),
    });

    const filename = `bilan-carbone-${new Date().toISOString().split('T')[0]}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
