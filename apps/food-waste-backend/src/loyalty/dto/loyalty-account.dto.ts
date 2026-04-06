import type {
  CreateLoyaltyAccountInput,
  AddPointsInput,
  DonatePointsInput,
  LoyaltyStats,
  DonatePointsResponse,
} from '@foodwaste/shared';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
  IsMongoId,
} from 'class-validator';

export class CreateLoyaltyAccountDto implements CreateLoyaltyAccountInput {
  @ApiProperty()
  @IsMongoId()
  userId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  referredBy?: string | undefined;
}

export class AddPointsDto implements AddPointsInput {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  offerId?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | undefined;

  @ApiProperty({
    required: false,
    description: 'Order total amount in TND for tracking totalAmountSpent',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderAmount?: number | undefined;

  @ApiProperty({
    required: false,
    description: 'Number of bags in the order (for tracking totalBagsSaved)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  bagCount?: number | undefined;

  @ApiProperty({
    required: false,
    description:
      'When true, skip the tier multiplier and award the exact amount. Use for gamification points (login streak, purchase streak, referrals, reviews).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  bypassMultiplier?: boolean | undefined;
}

export class LoyaltyStatsDto implements LoyaltyStats {
  @ApiProperty()
  totalPoints!: number;

  @ApiProperty()
  availablePoints!: number;

  @ApiProperty()
  lifetimePointsEarned!: number;

  @ApiProperty()
  totalOrdersCount!: number;

  @ApiProperty({ description: 'Total bags saved (actual bag count, not order count)' })
  totalBagsSaved!: number;

  @ApiProperty()
  totalAmountSpent!: number;

  @ApiProperty()
  currentTier!: string;

  @ApiProperty()
  badgeCount!: number;

  @ApiProperty()
  referralCount!: number;

  @ApiProperty()
  joinedAt!: string;

  @ApiProperty({ required: false })
  lastActivity?: string | undefined;
}

export class DonatePointsDto implements DonatePointsInput {
  @ApiProperty({ description: 'Number of points to donate', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({
    description: 'Optional: Make donation anonymous',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous!: boolean;

  @ApiProperty({ description: 'Optional: Custom message for the donation', required: false })
  @IsOptional()
  @IsString()
  message?: string | undefined;
}

export class DonatePointsResponseDto implements DonatePointsResponse {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  pointsDonated!: number;

  @ApiProperty()
  donationAmount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  estimatedMeals!: number;

  @ApiProperty()
  remainingPoints!: number;

  @ApiProperty()
  message!: string;
}
