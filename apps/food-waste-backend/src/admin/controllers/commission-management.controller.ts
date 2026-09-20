import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryOptimizer } from '../../common/utils/query-optimization.util';
import {
  CommissionManagementService,
  type CommissionSortKey,
} from '../services/commission-management.service';

@ApiTags('Admin — Commission')
@Controller('admin/commission')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class CommissionManagementController {
  constructor(private readonly commissionService: CommissionManagementService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Platform commission totals and the reconciliation identity',
    description:
      'sum(accrued) - sum(collected) must equal sum(Establishment.commissionDue). ' +
      'A non-zero delta means the ledger and the running balances disagree.',
  })
  @ApiResponse({ status: 200, description: 'Commission summary retrieved' })
  async getSummary() {
    const data = await this.commissionService.getSummary();
    return { message: 'Commission summary retrieved successfully', data };
  }

  @Get('merchants')
  @ApiOperation({ summary: 'Per-merchant commission balances, filterable' })
  @ApiResponse({ status: 200, description: 'Merchant commission rows retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'minDue', required: false, type: Number })
  @ApiQuery({ name: 'maxDue', required: false, type: Number })
  @ApiQuery({
    name: 'rateDriftAbove',
    required: false,
    type: Number,
    description: 'Only merchants whose effective rate is further than this from 0.19',
  })
  @ApiQuery({ name: 'neverSettled', required: false, type: Boolean })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async listMerchants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('minDue', new DefaultValuePipe(undefined), new ParseFloatPipe({ optional: true }))
    minDue?: number,
    @Query('maxDue', new DefaultValuePipe(undefined), new ParseFloatPipe({ optional: true }))
    maxDue?: number,
    @Query(
      'rateDriftAbove',
      new DefaultValuePipe(undefined),
      new ParseFloatPipe({ optional: true }),
    )
    rateDriftAbove?: number,
    @Query('neverSettled', new DefaultValuePipe(undefined), new ParseBoolPipe({ optional: true }))
    neverSettled?: boolean,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sortBy') sortBy?: CommissionSortKey,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const result = await this.commissionService.listMerchants({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(city ? { city } : {}),
      ...(minDue !== undefined ? { minDue } : {}),
      ...(maxDue !== undefined ? { maxDue } : {}),
      ...(rateDriftAbove !== undefined ? { rateDriftAbove } : {}),
      ...(neverSettled !== undefined ? { neverSettled } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sortOrder ? { sortOrder } : {}),
    });

    return {
      message: 'Merchant commission rows retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }

  @Get('cities')
  @ApiOperation({ summary: 'Distinct cities, for the commission filter control' })
  @ApiResponse({ status: 200, description: 'Cities retrieved' })
  async getCities() {
    const data = await this.commissionService.getCities();
    return { message: 'Cities retrieved successfully', data };
  }

  @Get('merchants/:establishmentId/ledger')
  @ApiOperation({ summary: 'Every commission movement for one establishment' })
  @ApiResponse({ status: 200, description: 'Commission ledger retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLedger(
    @Param('establishmentId') establishmentId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const result = await this.commissionService.getLedger(establishmentId, page, limit);

    return {
      message: 'Commission ledger retrieved successfully',
      data: {
        rows: result.data,
        establishmentName: result.establishmentName,
        commissionDue: result.commissionDue,
      },
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }
}
