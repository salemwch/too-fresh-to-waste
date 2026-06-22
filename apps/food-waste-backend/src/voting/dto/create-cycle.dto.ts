import { PrizeCategory } from '@foodwaste/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateIf,
  ValidateNested,
  Min,
  Max,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

import { CDN_IMAGE_PATTERN } from '../voting.constants';

export class CreatePrizeOptionDto {
  @ApiProperty({ example: 'Latest Smartphone' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Brand new flagship phone' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/...', required: false })
  @ValidateIf((_o, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @Matches(CDN_IMAGE_PATTERN, { message: 'imageUrl must match a trusted CDN domain' })
  imageUrl?: string;

  @ApiProperty({ enum: PrizeCategory })
  @IsEnum(PrizeCategory)
  category!: PrizeCategory;

  @ApiProperty({ example: '1000 DT' })
  @IsString()
  value!: string;
}

export class CreateCycleDto {
  @ApiProperty({ example: 'Summer 2026' })
  @IsString()
  name!: string;

  @ApiProperty()
  @IsDateString()
  cycleStartDate!: string;

  @ApiProperty()
  @IsDateString()
  cycleEndDate!: string;

  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(1)
  communityGoalTarget!: number;

  @ApiProperty({ example: 50, minimum: 1, maximum: 500 })
  @IsNumber()
  @Min(1)
  @Max(500)
  minimumBags!: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 50 })
  @IsNumber()
  @Min(1)
  @Max(50)
  recipientCount!: number;

  @ApiProperty({ type: [CreatePrizeOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @Type(() => CreatePrizeOptionDto)
  prizes!: CreatePrizeOptionDto[];
}
