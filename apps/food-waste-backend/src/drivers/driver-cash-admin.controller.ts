import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  MoveFloatDto,
  ReconciliationQueryDto,
  RecordHandoverDto,
  ResolveRecoveryDto,
} from './dto/driver-cash.dto';
import { DriverCashService } from './services/driver-cash.service';

/**
 * Admin side of driver cash: the float, counted handovers, recovery decisions
 * on failed deliveries, and the reconciliation report. ADMIN only - every
 * route moves or reports TFTW money. Model:
 * `.claude/work/commission-settlement-model.md` ("Driver cash").
 */
@Controller('admin/driver-cash')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DriverCashAdminController {
  constructor(private readonly driverCash: DriverCashService) {}

  /** Expected vs collected vs handed over vs outstanding, per driver, with flags. */
  @Get('reconciliation')
  async reconciliation(@Query() query: ReconciliationQueryDto) {
    const result = await this.driverCash.reconciliation({
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
    });
    return result;
  }

  @Post('drivers/:driverId/float')
  async moveFloat(
    @Param('driverId') driverId: string,
    @Body() dto: MoveFloatDto,
    @GetUser('id') actorId: string,
  ) {
    const result = await this.driverCash.moveFloat({
      driverId,
      type: dto.type,
      amount: dto.amount,
      actorId,
      ...(dto.reason ? { reason: dto.reason } : {}),
    });
    return result;
  }

  @Post('drivers/:driverId/handovers')
  async recordHandover(
    @Param('driverId') driverId: string,
    @Body() dto: RecordHandoverDto,
    @GetUser('id') receivedBy: string,
  ) {
    const result = await this.driverCash.recordHandover({
      driverId,
      amount: dto.amount,
      receivedBy,
      ...(dto.notes ? { notes: dto.notes } : {}),
    });
    return result;
  }

  @Patch('orders/:orderId/recovery')
  async resolveRecovery(@Param('orderId') orderId: string, @Body() dto: ResolveRecoveryDto) {
    await this.driverCash.resolveFailedRecovery(orderId, dto.recovery);
    return { orderId, recovery: dto.recovery };
  }
}
