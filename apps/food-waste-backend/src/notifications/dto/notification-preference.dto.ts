import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsObject,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

class ChannelPreferencesDto {
  @ApiProperty({ description: 'Enable push notifications for this channel' })
  @IsBoolean()
  push!: boolean;

  @ApiProperty({ description: 'Enable email notifications for this channel' })
  @IsBoolean()
  email!: boolean;

  @ApiProperty({ description: 'Enable SMS notifications for this channel' })
  @IsBoolean()
  sms!: boolean;
}

class QuietHoursDto {
  @ApiProperty({ description: 'Enable quiet hours' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ description: 'Start time in HH:MM format (24h)' })
  @IsString()
  startTime!: string;

  @ApiProperty({ description: 'End time in HH:MM format (24h)' })
  @IsString()
  endTime!: string;

  @ApiProperty({ description: 'Timezone for quiet hours' })
  @IsString()
  timezone!: string;
}

class SavedLocationDto {
  @ApiProperty({ description: 'Location name/label' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Latitude coordinate' })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'Longitude coordinate' })
  @IsNumber()
  longitude!: number;

  @ApiProperty({ description: 'Notification radius in kilometers' })
  @IsNumber()
  @Min(1)
  @Max(50)
  radius!: number;
}

class LocationPreferencesDto {
  @ApiProperty({ description: 'Default radius for nearby offers in kilometers' })
  @IsNumber()
  @Min(1)
  @Max(100)
  radius!: number;

  @ApiProperty({ description: 'Enable notifications for nearby offers' })
  @IsBoolean()
  enableNearbyOffers!: boolean;

  @ApiProperty({ description: 'Saved locations for notifications', type: [SavedLocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedLocationDto)
  savedLocations!: SavedLocationDto[];
}

@ApiExtraModels(ChannelPreferencesDto)
export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Channel-specific notification preferences',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ChannelPreferencesDto' },
  })
  @IsOptional()
  @IsObject()
  channels?: Record<string, ChannelPreferencesDto>;

  @ApiPropertyOptional({ description: 'Global push notification toggle' })
  @IsOptional()
  @IsBoolean()
  globalPushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Global email notification toggle' })
  @IsOptional()
  @IsBoolean()
  globalEmailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Global SMS notification toggle' })
  @IsOptional()
  @IsBoolean()
  globalSmsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Quiet hours settings', type: QuietHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @ApiPropertyOptional({ description: "User's preferred language code" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "User's timezone" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Location-based notification preferences',
    type: LocationPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationPreferencesDto)
  locationPreferences?: LocationPreferencesDto;
}

export class AddDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token for push notifications' })
  @IsString()
  deviceToken!: string;

  @ApiPropertyOptional({ description: 'Device platform (ios, android, web)' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'Device name/identifier' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class RemoveDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token to remove' })
  @IsString()
  deviceToken!: string;
}
