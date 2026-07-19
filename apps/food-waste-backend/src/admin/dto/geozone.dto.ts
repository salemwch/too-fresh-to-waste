import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsArray,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { GeozoneStatus } from '../schemas/geozone.schema';

class CoordinateDto {
  @ApiProperty() @IsNotEmpty() @IsNumber() latitude!: number;
  @ApiProperty() @IsNotEmpty() @IsNumber() longitude!: number;
}

export class CreateGeozoneDto {
  @ApiProperty({ maxLength: 100 }) @IsNotEmpty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty({ maxLength: 100 }) @IsNotEmpty() @IsString() @MaxLength(100) displayName!: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Polygon coordinates as [[lng, lat], ...]' })
  @IsNotEmpty()
  @IsArray()
  polygonCoordinates!: number[][];

  @ApiProperty({ type: CoordinateDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  center!: CoordinateDto;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) deliveryFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) minimumOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) defaultSearchRadius?: number;
}

export class UpdateGeozoneDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiPropertyOptional({ enum: GeozoneStatus })
  @IsOptional()
  @IsEnum(GeozoneStatus)
  status?: GeozoneStatus;

  @ApiPropertyOptional({ description: 'Polygon coordinates as [[lng, lat], ...]' })
  @IsOptional()
  @IsArray()
  polygonCoordinates?: number[][];

  @ApiPropertyOptional({ type: CoordinateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinateDto)
  center?: CoordinateDto;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) deliveryFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) minimumOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) defaultSearchRadius?: number;
}

export class GeozoneSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: GeozoneStatus })
  @IsOptional()
  @IsEnum(GeozoneStatus)
  status?: GeozoneStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) limit?: number = 20;
}
