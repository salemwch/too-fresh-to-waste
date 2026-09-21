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
  IsOptional,
  MaxLength,
} from 'class-validator';

import { CDN_IMAGE_PATTERN } from '../voting.constants';

/**
 * Caps a translated prize string. Matches nothing stricter than the default
 * field, which is unbounded today - this is about keeping an optional,
 * rarely-reviewed field from becoming an unbounded write vector, not about
 * editorial length.
 */
const PRIZE_TEXT_MAX_LENGTH = 500;

/**
 * Optional per-language variants of one admin-authored string.
 *
 * Both fields optional: the required default on the prize is the floor, so a
 * missing variant degrades to it rather than failing validation. `IsOptional`
 * rather than `ValidateIf` because an omitted key and an explicit `undefined`
 * should behave the same here - the admin form sends whichever the browser
 * felt like.
 */
export class LocalisedTextDto {
  @ApiProperty({ example: 'Dernier smartphone', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(PRIZE_TEXT_MAX_LENGTH)
  fr?: string;

  @ApiProperty({ example: 'أحدث هاتف ذكي', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(PRIZE_TEXT_MAX_LENGTH)
  ar?: string;
}

export class CreatePrizeOptionDto {
  @ApiProperty({ example: 'Latest Smartphone' })
  @IsString()
  name!: string;

  @ApiProperty({ type: LocalisedTextDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalisedTextDto)
  nameI18n?: LocalisedTextDto;

  @ApiProperty({ example: 'Brand new flagship phone' })
  @IsString()
  description!: string;

  @ApiProperty({ type: LocalisedTextDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalisedTextDto)
  descriptionI18n?: LocalisedTextDto;

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
  seasonBagTarget!: number;

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
