import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsUrl,
  MaxLength,
} from 'class-validator';

import {
  AnnouncementType,
  AnnouncementTarget,
  AnnouncementStatus,
} from '../schemas/announcement.schema';

export class CreateAnnouncementDto {
  @ApiProperty({ maxLength: 200 }) @IsNotEmpty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty({ maxLength: 5000 }) @IsNotEmpty() @IsString() @MaxLength(5000) content!: string;
  @ApiProperty({ enum: AnnouncementType })
  @IsNotEmpty()
  @IsEnum(AnnouncementType)
  type!: AnnouncementType;
  @ApiPropertyOptional({ enum: AnnouncementTarget })
  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dismissible?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsUrl() actionUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) actionLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zoneId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) priority?: number;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
  @ApiPropertyOptional({ enum: AnnouncementType })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;
  @ApiPropertyOptional({ enum: AnnouncementTarget })
  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;
  @ApiPropertyOptional({ enum: AnnouncementStatus })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dismissible?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsUrl() actionUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) actionLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zoneId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) priority?: number;
}

export class AnnouncementSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: AnnouncementType })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;
  @ApiPropertyOptional({ enum: AnnouncementStatus })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;
  @ApiPropertyOptional({ enum: AnnouncementTarget })
  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) limit?: number = 20;
}
