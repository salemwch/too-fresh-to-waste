import type { UpdateDonationPoolInput } from '@foodwaste/shared';
import { DonationGoalCategory } from '@foodwaste/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

/**
 * DTO for admin to update the active donation pool
 * All fields optional — only provided fields are updated (partial update)
 */
export class UpdateDonationPoolDto implements UpdateDonationPoolInput {
  @ApiPropertyOptional({
    description: 'New target amount for the donation pool',
    example: 5000,
    minimum: 1,
    maximum: 1_000_000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  targetAmount?: number | undefined;

  @ApiPropertyOptional({
    description: 'Cause / campaign description',
    example: 'Winter Food Relief 2026',
    minLength: 3,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  cause?: string | undefined;

  @ApiPropertyOptional({
    description: 'Active donation goal category — admin selects from fixed list',
    enum: DonationGoalCategory,
    example: DonationGoalCategory.TSHIRTS,
  })
  @IsOptional()
  @IsEnum(DonationGoalCategory)
  activeGoalCategory?: DonationGoalCategory | undefined;

  @ApiPropertyOptional({
    description: 'Target date / deadline for the pool (ISO 8601)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string | null | undefined;
}
