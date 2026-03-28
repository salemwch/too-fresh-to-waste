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

export class FavoritePreferenceDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTimes?: string[];

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  preferredDays?: number[];

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  maxDistance?: number;
}

export class AddFavoriteDto {
  @ApiProperty({ enum: FavoriteType })
  @IsEnum(FavoriteType)
  type!: FavoriteType;

  @ApiProperty()
  @IsMongoId()
  itemId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemImage?: string;

  @ApiProperty({ type: FavoritePreferenceDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FavoritePreferenceDto)
  preferences?: FavoritePreferenceDto;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFavoriteDto {
  @ApiProperty({ type: FavoritePreferenceDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FavoritePreferenceDto)
  preferences?: FavoritePreferenceDto;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FavoritesFilterDto {
  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }) => {
    // Handle string boolean conversion from query params
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    if (value === '1') {
      return true;
    }
    if (value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, default: '-addedAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    enum: EstablishmentType,
    required: false,
    description: 'Filter by establishment type (e.g., restaurant, bakery)',
  })
  @IsOptional()
  @IsEnum(EstablishmentType)
  establishmentType?: EstablishmentType;
}

export class CreateFavoriteListDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ListVisibility, required: false, default: ListVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(ListVisibility)
  visibility?: ListVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconEmoji?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateFavoriteListDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ListVisibility, required: false })
  @IsOptional()
  @IsEnum(ListVisibility)
  visibility?: ListVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconEmoji?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddToListDto {
  @ApiProperty()
  @IsMongoId()
  itemId!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;
}

export class ShareListDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  userIds!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
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

export class RecommendationFiltersDto {
  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxDistance?: number;

  @ApiProperty({ required: false, default: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}

export class TrendsFiltersDto {
  @ApiProperty({
    required: false,
    default: 'week',
    enum: ['day', 'week', 'month', 'quarter', 'year'],
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'quarter', 'year'])
  period?: string;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ enum: FavoriteType, required: false })
  @IsOptional()
  @IsEnum(FavoriteType)
  type?: FavoriteType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minFavoriteCount?: number;
}
