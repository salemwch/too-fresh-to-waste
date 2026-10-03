import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

import { SALES_PERIODS, type SalesPeriod } from '../../merchant-sales/merchant-sales.period';

/**
 * Query params for `GET /orders/stats`.
 *
 * `period` is the merchant-dashboard period, resolved server-side in
 * Africa/Tunis via `resolveSalesPeriod` - the same clock the earnings
 * summary/chart use. `startDate` is the older, caller-supplied cutoff still
 * used elsewhere (e.g. by a caller with no notion of `SalesPeriod`). When
 * both are sent, `period` wins: see `OrdersService.getOrderStats`.
 */
export class OrderStatsQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 8601 date - filter orders from this date (e.g. 2025-06-01T00:00:00.000Z)',
  })
  @IsOptional()
  @IsString()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter stats to a specific establishment (merchants only)' })
  @IsOptional()
  @IsString()
  @IsMongoId()
  establishmentId?: string;

  @ApiPropertyOptional({
    enum: SALES_PERIODS,
    description: 'Resolved server-side in Africa/Tunis. Wins over `startDate` when both are sent.',
  })
  @IsOptional()
  @IsIn(SALES_PERIODS)
  period?: SalesPeriod;
}
