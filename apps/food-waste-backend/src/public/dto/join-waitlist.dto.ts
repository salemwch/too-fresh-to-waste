import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { WaitlistAudience } from '../../waitlist/schemas/waitlist-entry.schema';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'amine@example.tn', maxLength: 254 })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'tunis', description: 'Geozone name to wait for.', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  zone!: string;

  @ApiPropertyOptional({ enum: WaitlistAudience, default: WaitlistAudience.CONSUMER })
  @IsOptional()
  @IsEnum(WaitlistAudience)
  audience?: WaitlistAudience;
}
