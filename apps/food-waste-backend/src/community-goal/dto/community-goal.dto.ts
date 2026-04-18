import type { SetGoalTargetInput, CommunityGoalStats } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, Max, IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';

import { CommunityGoalCauseType } from '../schemas/community-bag-goal.schema';

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

  @ApiPropertyOptional({ enum: CommunityGoalCauseType, example: CommunityGoalCauseType.FOOD })
  @IsOptional()
  @IsEnum(CommunityGoalCauseType)
  causeType?: CommunityGoalCauseType;

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
}

export class CommunityGoalStatsResponseDto implements CommunityGoalStats {
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

  @ApiProperty({ example: 'active', enum: ['active', 'completed', 'archived'] })
  status!: 'active' | 'completed' | 'archived';

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  lastUpdatedAt!: string;

  @ApiPropertyOptional({ enum: CommunityGoalCauseType })
  causeType?: CommunityGoalCauseType;

  @ApiPropertyOptional({ example: 'Feed Families This Ramadan' })
  causeTitle?: string;

  @ApiPropertyOptional()
  causeDescription?: string;
}
