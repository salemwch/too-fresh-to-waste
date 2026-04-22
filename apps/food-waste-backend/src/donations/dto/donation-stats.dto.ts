import type { DonationStatsResponse, UserDonationStatsResponse } from '@foodwaste/shared';
import { DonationGoalCategory } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';

import { DonationPoolStatus } from '../schemas/donation-pool.schema';

/**
 * Response DTO for donation statistics
 * Used by the frontend to display impact metrics
 */
export class DonationStatsResponseDto implements DonationStatsResponse {
  @ApiProperty({
    description: 'Total donations collected in the current pool',
    example: 847.3,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalDonations!: number;

  @ApiProperty({
    description: 'Target amount for the current pool',
    example: 1000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  targetAmount!: number;

  @ApiProperty({
    description: 'Estimated number of meals funded',
    example: 169,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  mealCount!: number;

  @ApiProperty({
    description: 'Total number of unique contributors',
    example: 1843,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  contributorCount!: number;

  @ApiProperty({
    description: 'Progress percentage towards target',
    example: 84.73,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  progressPercentage!: number;

  @ApiProperty({
    description: 'Current pool status',
    enum: DonationPoolStatus,
    example: DonationPoolStatus.ACTIVE,
  })
  @IsEnum(DonationPoolStatus)
  status!: DonationPoolStatus;

  @ApiProperty({
    description: 'Cause description',
    example: 'Winter Food Relief 2025',
  })
  @IsString()
  cause!: string;

  @ApiProperty({
    description: 'Active donation goal category',
    enum: DonationGoalCategory,
    example: DonationGoalCategory.TSHIRTS,
  })
  @IsEnum(DonationGoalCategory)
  activeGoalCategory!: DonationGoalCategory;

  @ApiProperty({
    description: 'Currency code',
    example: 'TND',
  })
  @IsString()
  currency!: string;

  @ApiPropertyOptional({
    description: 'Target date for reaching the goal',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string | undefined;
}

/**
 * Response DTO for user-specific donation statistics
 */
export class UserDonationStatsResponseDto implements UserDonationStatsResponse {
  @ApiProperty({
    description: 'Total amount donated by the user',
    example: 2.45,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalDonated!: number;

  @ApiProperty({
    description: 'Number of contributions made',
    example: 49,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  contributionCount!: number;

  @ApiProperty({
    description: 'Badges earned through gamification',
    example: ['first_step', 'community_helper'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  badgesEarned!: string[];

  @ApiProperty({
    description: 'Estimated meals contributed by user',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  mealsContributed!: number;

  @ApiProperty({
    description: 'User rank among all contributors',
    example: 142,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  rank!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'TND',
  })
  @IsString()
  currency!: string;
}
