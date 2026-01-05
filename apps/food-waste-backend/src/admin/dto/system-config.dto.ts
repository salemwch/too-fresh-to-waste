import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable maintenance mode',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({
    description: 'Allow new user registrations',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  allowNewRegistrations?: boolean;

  @ApiPropertyOptional({
    description: 'Require manual approval for establishments',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  requireEstablishmentApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum offers per establishment',
    example: 50,
    minimum: 1,
    maximum: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxOffersPerEstablishment?: number;

  @ApiPropertyOptional({
    description: 'Default offer expiration in hours',
    example: 24,
    minimum: 1,
    maximum: 168
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  defaultOfferExpirationHours?: number;

  @ApiPropertyOptional({
    description: 'Minimum order value in currency units',
    example: 1,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum order value in currency units',
    example: 1000,
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Platform commission rate as percentage',
    example: 15,
    minimum: 0,
    maximum: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  platformCommissionRate?: number;

  @ApiPropertyOptional({
    description: 'Automatic refund timeout in hours',
    example: 24,
    minimum: 1,
    maximum: 168
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  autoRefundTimeoutHours?: number;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable email notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable SMS notifications',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable push notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable admin email alerts',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  adminEmailAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable order confirmation notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  orderConfirmationEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable order reminder notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  orderReminderEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable promotional email notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  promotionalEmailsEnabled?: boolean;
}

export class SecuritySettingsDto {
  @ApiPropertyOptional({
    description: 'Maximum login attempts before lockout',
    example: 5,
    minimum: 3,
    maximum: 10
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  maxLoginAttempts?: number;

  @ApiPropertyOptional({
    description: 'Login attempt window in minutes',
    example: 15,
    minimum: 5,
    maximum: 60
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  loginAttemptWindow?: number;

  @ApiPropertyOptional({
    description: 'Account lockout duration in minutes',
    example: 30,
    minimum: 5,
    maximum: 1440
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  accountLockoutDuration?: number;

  @ApiPropertyOptional({
    description: 'Minimum password length',
    example: 8,
    minimum: 6,
    maximum: 128
  })
  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(128)
  passwordMinLength?: number;

  @ApiPropertyOptional({
    description: 'Require special characters in password',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChar?: boolean;

  @ApiPropertyOptional({
    description: 'Require numbers in password',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @ApiPropertyOptional({
    description: 'Require uppercase letters in password',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @ApiPropertyOptional({
    description: 'Session timeout in minutes',
    example: 480,
    minimum: 30,
    maximum: 1440
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(1440)
  sessionTimeout?: number;

  @ApiPropertyOptional({
    description: 'Require two-factor authentication',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  twoFactorAuthRequired?: boolean;
}

export class PaymentSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable Stripe payments',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  stripeEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable PayPal payments',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  paypalEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum payout amount',
    example: 10,
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumPayoutAmount?: number;

  @ApiPropertyOptional({
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Automatic payout frequency',
    example: 'weekly'
  })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  payoutFrequency?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({
    description: 'Enable automatic payouts',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  automaticPayouts?: boolean;

  @ApiPropertyOptional({
    description: 'Refund processing time in days',
    example: 3,
    minimum: 1,
    maximum: 30
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  refundProcessingDays?: number;
}

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({
    description: 'Platform configuration settings',
    type: PlatformSettingsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformSettingsDto)
  platformSettings?: PlatformSettingsDto;

  @ApiPropertyOptional({
    description: 'Notification configuration settings',
    type: NotificationSettingsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notificationSettings?: NotificationSettingsDto;

  @ApiPropertyOptional({
    description: 'Security configuration settings',
    type: SecuritySettingsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  securitySettings?: SecuritySettingsDto;

  @ApiPropertyOptional({
    description: 'Payment configuration settings',
    type: PaymentSettingsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentSettingsDto)
  paymentSettings?: PaymentSettingsDto;

  @ApiPropertyOptional({
    description: 'Configuration description',
    example: 'Updated security settings for enhanced protection'
  })
  @IsOptional()
  @IsString()
  description?: string;
}