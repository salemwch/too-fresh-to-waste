import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

import { SALES_PERIODS, type SalesPeriod } from '../merchant-sales.period';
import { EARNINGS_TABS, type EarningsTab } from '../merchant-sales.types';

export class MerchantSalesQueryDto {
  @ApiPropertyOptional({ enum: SALES_PERIODS, default: 'month' })
  @IsOptional()
  @IsIn(SALES_PERIODS)
  period?: SalesPeriod = 'month';

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  establishmentId?: string;
}

export class MerchantEarningsRowsQueryDto extends MerchantSalesQueryDto {
  @ApiPropertyOptional({ enum: EARNINGS_TABS, default: 'earnings' })
  @IsOptional()
  @IsIn(EARNINGS_TABS)
  tab?: EarningsTab = 'earnings';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  after?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
