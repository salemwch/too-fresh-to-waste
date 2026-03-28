import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for updating user's last known location
 *
 * Stores user's preferred location for location-based features:
 * - Nearby offers discovery
 * - Distance calculations
 * - Cross-device sync
 *
 * Privacy: Location is stored securely and only used for app functionality
 */
export class UpdateLocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 35.8288,
    minimum: -90,
    maximum: 90,
  })
  @IsLatitude({ message: 'Latitude must be between -90 and 90' })
  latitude!: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 10.6405,
    minimum: -180,
    maximum: 180,
  })
  @IsLongitude({ message: 'Longitude must be between -180 and 180' })
  longitude!: number;

  @ApiProperty({
    description: 'Display name for the location (e.g., "Sousse, Tunisia")',
    example: 'Sousse, Tunisia',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Location name cannot exceed 255 characters' })
  locationName?: string;

  @ApiProperty({
    description: 'Source of the location (gps, manual, etc.)',
    example: 'gps',
    required: false,
    enum: ['gps', 'network', 'passive', 'manual', 'ip'],
  })
  @IsOptional()
  @IsString()
  source?: 'gps' | 'network' | 'passive' | 'manual' | 'ip';
}
