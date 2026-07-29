import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

import { OrderStatus } from '@foodwaste/shared';

export class DriverOrdersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  /**
   * Optional status filter. Omitted means "every order this driver ever
   * touched" — admins investigating a complaint need the cancelled and
   * expired ones too, not only the delivered happy path.
   */
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
