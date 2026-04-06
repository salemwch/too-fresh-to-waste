import type {
  AddFavoriteInput,
  UpdateFavoriteInput,
  FavoritesFilterInput,
  CreateFavoriteListInput,
  UpdateFavoriteListInput,
  AddToListInput,
  ShareListInput,
  RecommendationFiltersInput,
  TrendsFiltersInput,
} from '@foodwaste/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsArray,
  IsMongoId,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

import { EstablishmentType } from '../../common/enums';
import { ListVisibility } from '../schemas/favorite-list.schema';
import { FavoriteType } from '../schemas/favorite.schema';

function parseBooleanQueryValue(value: unknown): unknown {
  // Handle string boolean conversion from query params
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }

  return value;
}

class FavoritePreferenceDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean | undefined;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean | undefined;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTimes?: string[] | undefined;

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  preferredDays?: number[] | undefined;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  maxDistance?: number | undefined;
}

export class AddFavoriteDto implements AddFavoriteInput {
  @ApiProperty({ enum: FavoriteType })
  @IsEnum(FavoriteType)
  type!: FavoriteType;

  @ApiProperty()
  @IsMongoId()
  itemId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemName?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemImage?: string | undefined;

  @ApiProperty({ type: FavoritePreferenceDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FavoritePreferenceDto)
  preferences?: FavoritePreferenceDto | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;
}

export class UpdateFavoriteDto implements UpdateFavoriteInput {
  @ApiProperty({ type: FavoritePreferenceDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FavoritePreferenceDto)
  preferences?: FavoritePreferenceDto | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | undefined;
}

export class FavoritesFilterDto implements FavoritesFilterInput {
  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tag?: string | undefined;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }) => parseBooleanQueryValue(value))
  @IsBoolean()
  isActive?: boolean | undefined;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page!: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit!: number;

  @ApiProperty({ required: false, default: '-addedAt' })
  @IsOptional()
  @IsString()
  sortBy!: string;

  @ApiProperty({
    enum: EstablishmentType,
    required: false,
    description: 'Filter by establishment type (e.g., restaurant, bakery)',
  })
  @IsOptional()
  @IsEnum(EstablishmentType)
  establishmentType?: EstablishmentType | undefined;
}

export class CreateFavoriteListDto implements CreateFavoriteListInput {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | undefined;

  @ApiProperty({ enum: ListVisibility, required: false, default: ListVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(ListVisibility)
  visibility!: ListVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconEmoji?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverImage?: string | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;
}

export class UpdateFavoriteListDto implements UpdateFavoriteListInput {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | undefined;

  @ApiProperty({ enum: ListVisibility, required: false })
  @IsOptional()
  @IsEnum(ListVisibility)
  visibility?: ListVisibility | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconEmoji?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverImage?: string | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | undefined;
}

export class AddToListDto implements AddToListInput {
  @ApiProperty()
  @IsMongoId()
  itemId!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number | undefined;
}

export class ShareListDto implements ShareListInput {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  userIds!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string | undefined;
}

export class FavoriteStatsDto {
  @ApiProperty()
  totalFavorites!: number;

  @ApiProperty()
  favoriteEstablishments!: number;

  @ApiProperty()
  favoriteOffers!: number;

  @ApiProperty()
  favoriteCategories!: number;

  @ApiProperty()
  totalLists!: number;

  @ApiProperty()
  activeLists!: number;

  @ApiProperty()
  sharedLists!: number;

  @ApiProperty()
  totalNotifications!: number;

  @ApiProperty()
  recentActivity!: number;
}

export class RecommendationDto {
  @ApiProperty()
  itemId!: string;

  @ApiProperty({ enum: FavoriteType })
  type!: FavoriteType;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ required: false })
  itemImage?: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ required: false })
  rating?: number;

  @ApiProperty({ required: false })
  distance?: number;

  @ApiProperty({ required: false })
  price?: number;

  @ApiProperty()
  similarityScore!: number;
}

export class RecommendationsResponseDto {
  @ApiProperty({ type: [RecommendationDto] })
  recommendations!: RecommendationDto[];

  @ApiProperty()
  totalRecommendations!: number;

  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  basedOnFavoritesCount!: number;

  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  confidence!: number;
}

export class TrendItemDto {
  @ApiProperty()
  itemId!: string;

  @ApiProperty({ enum: FavoriteType })
  type!: FavoriteType;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ required: false })
  itemImage?: string;

  @ApiProperty()
  favoriteCount!: number;

  @ApiProperty()
  growthRate!: number;

  @ApiProperty()
  rank!: number;

  @ApiProperty({ type: [String] })
  popularTags!: string[];

  @ApiProperty({ required: false })
  averageRating?: number;

  @ApiProperty()
  trendScore!: number;
}

export class TrendsResponseDto {
  @ApiProperty({ type: [TrendItemDto] })
  trends!: TrendItemDto[];

  @ApiProperty()
  period!: string;

  @ApiProperty()
  totalTrends!: number;

  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  periodStartDate!: Date;

  @ApiProperty()
  periodEndDate!: Date;
}

export class RecommendationFiltersDto implements RecommendationFiltersInput {
  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit!: number;

  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string | undefined;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxDistance?: number | undefined;

  @ApiProperty({ required: false, default: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number | undefined;
}

export class TrendsFiltersDto implements TrendsFiltersInput {
  @ApiProperty({
    required: false,
    default: 'week',
    enum: ['day', 'week', 'month', 'quarter', 'year'],
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'quarter', 'year'])
  period!: 'day' | 'week' | 'month' | 'quarter' | 'year';

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit!: number;

  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string | undefined;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minFavoriteCount?: number | undefined;
}
