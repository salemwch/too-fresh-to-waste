import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, Max, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for admin to update the active donation pool
 * All fields optional — only provided fields are updated (partial update)
 */
export class UpdateDonationPoolDto {
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
  targetAmount?: number;

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
  cause?: string;
}
