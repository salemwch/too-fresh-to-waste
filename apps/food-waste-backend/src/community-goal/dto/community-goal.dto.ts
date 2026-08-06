import type { SetGoalTargetInput, MonthlyBagGoalStats } from '@foodwaste/shared';
import { MonthlyGoalStatus } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';

import { MonthlyGoalCauseType } from '../schemas/community-bag-goal.schema';

export class SetGoalTargetDto implements SetGoalTargetInput {
  @ApiProperty({
    description: 'Target bag count for the community goal',
    minimum: 100,
    maximum: 1_000_000,
    example: 10000,
  })
  @IsNumber()
  @Min(100)
  @Max(1_000_000)
  targetCount!: number;

  @ApiPropertyOptional({ enum: MonthlyGoalCauseType, example: MonthlyGoalCauseType.FOOD })
  @IsOptional()
  @IsEnum(MonthlyGoalCauseType)
  causeType?: MonthlyGoalCauseType;

  @ApiPropertyOptional({ example: 'Feed Families This Ramadan', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  causeTitle?: string;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  causeDescription?: string;

  @ApiPropertyOptional({ example: 'June Challenge', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  seasonName?: string;

  @ApiPropertyOptional({
    description: 'Optional deadline — challenge expires if target not reached by this date',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class MonthlyBagGoalStatsResponseDto implements MonthlyBagGoalStats {
  @ApiProperty({ example: 1234 })
  currentCount!: number;

  @ApiProperty({ example: 8000 })
  targetCount!: number;

  @ApiProperty({ example: 15.43 })
  progressPercentage!: number;

  @ApiProperty({ example: 6766 })
  remaining!: number;

  @ApiProperty({ example: 1 })
  cycleNumber!: number;

  @ApiProperty({ example: 'active', enum: MonthlyGoalStatus })
  status!: MonthlyGoalStatus;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  lastUpdatedAt!: string;

  @ApiPropertyOptional({ enum: MonthlyGoalCauseType })
  causeType?: MonthlyGoalCauseType;

  @ApiPropertyOptional({ example: 'Feed Families This Ramadan' })
  causeTitle?: string;

  @ApiPropertyOptional()
  causeDescription?: string;

  @ApiPropertyOptional({ example: 'June Challenge' })
  seasonName?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  endDate?: string;

  @ApiPropertyOptional({ example: 42 })
  participantCount?: number;
}
