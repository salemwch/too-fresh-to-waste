import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

import { SALES_PERIODS, type SalesPeriod } from '../../merchant-sales/merchant-sales.period';

/**
 * Query params for `GET /sustainability/carbon-metrics` and
 * `GET /sustainability/social-impact`.
 *
 * `period` is the merchant-dashboard period, resolved server-side in
 * Africa/Tunis via `resolveSalesPeriod` - the same clock the earnings
 * summary/chart use. `since` is the older, caller-supplied cutoff still used
 * by the ESG and Community pages, which call these endpoints with no period
 * at all. When both are sent, `period` wins.
 */
export class SustainabilityMetricsQueryDto {
  @ApiPropertyOptional({ description: 'ISO date string filter (e.g. 2025-01-01)' })
  @IsOptional()
  @IsString()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({ description: 'Filter by establishment' })
  @IsOptional()
  @IsString()
  @IsMongoId()
  establishmentId?: string;

  @ApiPropertyOptional({
    enum: SALES_PERIODS,
    description: 'Resolved server-side in Africa/Tunis. Wins over `since` when both are sent.',
  })
  @IsOptional()
  @IsIn(SALES_PERIODS)
  period?: SalesPeriod;
}
