import { IsString, IsBoolean, IsNumber, IsArray, IsOptional, IsEnum, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EmailNotificationPreferencesDto {
    @ApiPropertyOptional({ description: 'Receive marketing emails' })
    @IsOptional()
    @IsBoolean()
    marketing?: boolean;

    @ApiPropertyOptional({ description: 'Receive order update emails' })
    @IsOptional()
    @IsBoolean()
    orderUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Receive new offers emails' })
    @IsOptional()
    @IsBoolean()
    newOffers?: boolean;

    @ApiPropertyOptional({ description: 'Receive weekly digest emails' })
    @IsOptional()
    @IsBoolean()
    weeklyDigest?: boolean;

    @ApiPropertyOptional({ description: 'Receive security alert emails' })
    @IsOptional()
    @IsBoolean()
    securityAlerts?: boolean;
}

export class PushNotificationPreferencesDto {
    @ApiPropertyOptional({ description: 'Receive order update push notifications' })
    @IsOptional()
    @IsBoolean()
    orderUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Receive nearby offers push notifications' })
    @IsOptional()
    @IsBoolean()
    nearbyOffers?: boolean;

    @ApiPropertyOptional({ description: 'Receive favorite store offers push notifications' })
    @IsOptional()
    @IsBoolean()
    favoriteStoreOffers?: boolean;

    @ApiPropertyOptional({ description: 'Receive new messages push notifications' })
    @IsOptional()
    @IsBoolean()
    newMessages?: boolean;
}

export class SmsNotificationPreferencesDto {
    @ApiPropertyOptional({ description: 'Receive order confirmation SMS' })
    @IsOptional()
    @IsBoolean()
    orderConfirmation?: boolean;

    @ApiPropertyOptional({ description: 'Receive security alerts SMS' })
    @IsOptional()
    @IsBoolean()
    securityAlerts?: boolean;
}

export class NotificationPreferencesDto {
    @ApiPropertyOptional({ type: EmailNotificationPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EmailNotificationPreferencesDto)
    email?: EmailNotificationPreferencesDto;

    @ApiPropertyOptional({ type: PushNotificationPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => PushNotificationPreferencesDto)
    push?: PushNotificationPreferencesDto;

    @ApiPropertyOptional({ type: SmsNotificationPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => SmsNotificationPreferencesDto)
    sms?: SmsNotificationPreferencesDto;
}

export class PrivacyPreferencesDto {
    @ApiPropertyOptional({
        enum: ['public', 'friends', 'private'],
        description: 'Profile visibility setting'
    })
    @IsOptional()
    @IsEnum(['public', 'friends', 'private'])
    profileVisibility?: 'public' | 'friends' | 'private';

    @ApiPropertyOptional({ description: 'Show online status to other users' })
    @IsOptional()
    @IsBoolean()
    showOnlineStatus?: boolean;

    @ApiPropertyOptional({ description: 'Allow data analytics collection' })
    @IsOptional()
    @IsBoolean()
    allowDataAnalytics?: boolean;

    @ApiPropertyOptional({ description: 'Allow personalization features' })
    @IsOptional()
    @IsBoolean()
    allowPersonalization?: boolean;
}

export class DiscoveryPreferencesDto {
    @ApiPropertyOptional({
        description: 'Maximum search distance in meters',
        minimum: 100,
        maximum: 50000
    })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(50000)
    maxDistance?: number;

    @ApiPropertyOptional({
        description: 'Preferred food categories',
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferredCategories?: string[];

    @ApiPropertyOptional({
        description: 'Excluded food categories',
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    excludedCategories?: string[];

    @ApiPropertyOptional({
        description: 'Minimum discount percentage',
        minimum: 0,
        maximum: 100
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    minDiscount?: number;

    @ApiPropertyOptional({ description: 'Show items expiring soon' })
    @IsOptional()
    @IsBoolean()
    showExpiringSoon?: boolean;

    @ApiPropertyOptional({ description: 'Automatically save search preferences' })
    @IsOptional()
    @IsBoolean()
    autoSaveSearches?: boolean;
}

export class UpdateUserPreferencesDto {
    @ApiPropertyOptional({
        enum: ['light', 'dark', 'auto'],
        description: 'UI theme preference'
    })
    @IsOptional()
    @IsEnum(['light', 'dark', 'auto'])
    theme?: 'light' | 'dark' | 'auto';

    @ApiPropertyOptional({
        description: 'Language preference (ISO 639-1 code)',
        example: 'en'
    })
    @IsOptional()
    @IsString()
    language?: string;

    @ApiPropertyOptional({
        description: 'Timezone preference',
        example: 'UTC'
    })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({
        description: 'Currency preference (ISO 4217 code)',
        example: 'USD'
    })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiPropertyOptional({ type: NotificationPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => NotificationPreferencesDto)
    notifications?: NotificationPreferencesDto;

    @ApiPropertyOptional({ type: PrivacyPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => PrivacyPreferencesDto)
    privacy?: PrivacyPreferencesDto;

    @ApiPropertyOptional({ type: DiscoveryPreferencesDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DiscoveryPreferencesDto)
    discovery?: DiscoveryPreferencesDto;
}