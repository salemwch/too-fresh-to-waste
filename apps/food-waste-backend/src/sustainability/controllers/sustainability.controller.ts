import { UserRole } from '@foodwaste/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Query,
  Request,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateMonthlyGoalDto } from '../dto/sustainability.dto';
import type {
  CarbonMetricsResponse,
  EsgTierResponse,
  MonthlyGoalResponse,
  SocialImpactResponse,
  StreakResponse,
} from '../dto/sustainability.dto';
import { PdfReportService } from '../services/pdf-report.service';
import { StreakService } from '../services/streak.service';
import { SustainabilityService } from '../services/sustainability.service';

@ApiTags('Sustainability')
@ApiBearerAuth()
@Controller('sustainability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
export class SustainabilityController {
  private readonly logger = new Logger(SustainabilityController.name);

  constructor(
    private readonly sustainabilityService: SustainabilityService,
    private readonly pdfReportService: PdfReportService,
    private readonly streakService: StreakService,
  ) {}

  @Get('tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant ESG tier and milestone progress' })
  @ApiResponse({ status: HttpStatus.OK, description: 'ESG tier data retrieved' })
  async getEsgTier(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string; data: EsgTierResponse }> {
    const data = await this.sustainabilityService.getEsgTier(req.user.userId);
    return { message: 'ESG tier retrieved successfully', data };
  }

  @Get('monthly-goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant monthly bag-saving goal progress' })
  async getMonthlyGoal(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string; data: MonthlyGoalResponse }> {
    const data = await this.sustainabilityService.getMonthlyGoal(req.user.userId);
    return { message: 'Monthly goal retrieved successfully', data };
  }

  @Patch('monthly-goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update merchant monthly bag-saving goal' })
  async updateMonthlyGoal(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: UpdateMonthlyGoalDto,
  ): Promise<{ message: string; data: MonthlyGoalResponse }> {
    const data = await this.sustainabilityService.updateMonthlyGoal(
      req.user.userId,
      dto.targetBagsPerMonth,
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
  async getCarbonMetrics(
    @Request() req: AuthenticatedRequest,
    @Query('since') since?: string,
  ): Promise<{ message: string; data: CarbonMetricsResponse }> {
    const startDate = since ? new Date(since) : undefined;
    const data = await this.sustainabilityService.getCarbonMetrics(req.user.userId, startDate);
    return { message: 'Carbon metrics retrieved successfully', data };
  }

  @Get('social-impact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get social impact (meals distributed, people served)' })
  @ApiQuery({ name: 'since', required: false, description: 'ISO date string filter' })
  async getSocialImpact(
    @Request() req: AuthenticatedRequest,
    @Query('since') since?: string,
  ): Promise<{ message: string; data: SocialImpactResponse }> {
    const startDate = since ? new Date(since) : undefined;
    const data = await this.sustainabilityService.getSocialImpact(req.user.userId, startDate);
    return { message: 'Social impact retrieved successfully', data };
  }

  @Get('streak')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant daily listing streak data' })
  async getStreak(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string; data: StreakResponse }> {
    const data = await this.streakService.getStreakData(req.user.userId);
    return { message: 'Streak data retrieved successfully', data };
  }

  @Get('reports/carbon-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download ESG Carbon Balance PDF report (ISO 14001 format)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'PDF binary stream' })
  async downloadCarbonBalanceReport(
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(`Carbon balance PDF requested by merchant ${req.user.userId}`);

    const [tier, goal, carbon, social] = await Promise.all([
      this.sustainabilityService.getEsgTier(req.user.userId),
      this.sustainabilityService.getMonthlyGoal(req.user.userId),
      this.sustainabilityService.getCarbonMetrics(req.user.userId),
      this.sustainabilityService.getSocialImpact(req.user.userId),
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
