import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class InitiateSubscriptionDto {
  @ApiProperty({
    enum: ['standard', 'pro'],
    description: 'Subscription tier',
  })
  @IsEnum(['standard', 'pro'])
  tier!: 'standard' | 'pro';

  @ApiProperty({
    enum: ['monthly', 'yearly'],
    description: 'Billing cycle',
  })
  @IsEnum(['monthly', 'yearly'])
  cycle!: 'monthly' | 'yearly';

  @ApiPropertyOptional({
    description: 'Establishment ID (required if merchant owns multiple)',
  })
  @IsOptional()
  @IsString()
  establishmentId?: string;
}

export class SubscriptionStatusResponseDto {
  @ApiProperty()
  subscriptionStatus!: 'trial' | 'paid' | 'suspended';

  @ApiPropertyOptional()
  subscriptionTier?: 'standard' | 'pro';

  @ApiPropertyOptional()
  subscriptionCycle?: 'monthly' | 'yearly';

  @ApiPropertyOptional()
  trialEndsAt?: Date;

  @ApiPropertyOptional()
  subscriptionExpiresAt?: Date;

  @ApiProperty()
  canPublishOffers!: boolean;
}

export class InitiatePaymentResponseDto {
  @ApiProperty({ description: 'Konnect payment page URL to redirect the merchant to' })
  payUrl!: string;

  @ApiProperty({ description: 'Konnect payment reference for tracking' })
  paymentRef!: string;
}
