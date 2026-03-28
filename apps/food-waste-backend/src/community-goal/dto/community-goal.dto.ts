import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

export class SetGoalTargetDto {
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
}

export class CommunityGoalStatsResponseDto {
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
  status!: string;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  lastUpdatedAt!: string;
}
