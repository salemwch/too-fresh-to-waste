import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, IsBoolean, IsEnum, IsArray, ValidateNested, IsDate, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { BadgeType } from '../schemas/loyalty-account.schema';

export class BadgeDto {
  @ApiProperty({ enum: BadgeType })
  @IsEnum(BadgeType)
  type: BadgeType;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  earnedAt: Date;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  iconUrl: string;
}

export class CreateLoyaltyAccountDto {
  @ApiProperty()
  @IsMongoId()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  referredBy?: string;
}

export class UpdateLoyaltyAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPoints?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  availablePoints?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currentTier?: string;

  @ApiProperty({ type: [BadgeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BadgeDto)
  badges?: BadgeDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddPointsDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  offerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiProperty({ required: false, description: 'Order total amount in TND for tracking totalAmountSpent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderAmount?: number;

  @ApiProperty({ required: false, description: 'Number of bags in the order (for tracking totalBagsSaved)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  bagCount?: number;

  @ApiProperty({
    required: false,
    description: 'When true, skip the tier multiplier and award the exact amount. Use for gamification points (login streak, purchase streak, referrals, reviews).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  bypassMultiplier?: boolean;
}

export class RedeemPointsDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string;
}

export class LoyaltyStatsDto {
  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  availablePoints: number;

  @ApiProperty()
  lifetimePointsEarned: number;

  @ApiProperty()
  totalOrdersCount: number;

  @ApiProperty({ description: 'Total bags saved (actual bag count, not order count)' })
  totalBagsSaved: number;

  @ApiProperty()
  totalAmountSpent: number;

  @ApiProperty()
  currentTier: string;

  @ApiProperty()
  badgeCount: number;

  @ApiProperty()
  referralCount: number;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ required: false })
  lastActivity?: Date;
}

export class DonatePointsDto {
  @ApiProperty({ description: 'Number of points to donate', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Optional: Make donation anonymous', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @ApiProperty({ description: 'Optional: Custom message for the donation', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

export class DonatePointsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  pointsDonated: number;

  @ApiProperty()
  donationAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  estimatedMeals: number;

  @ApiProperty()
  remainingPoints: number;

  @ApiProperty()
  message: string;
}