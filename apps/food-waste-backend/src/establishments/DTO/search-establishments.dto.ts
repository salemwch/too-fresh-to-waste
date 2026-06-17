import type { SearchEstablishmentsInput } from '@foodwaste/shared';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';

import { EstablishmentType, EstablishmentStatus } from '../schemas/establishment.schema';

export class SearchEstablishmentsDto implements SearchEstablishmentsInput {
  @IsOptional()
  @IsString()
  search?: string | undefined;

  @IsOptional()
  @IsEnum(EstablishmentType)
  type?: EstablishmentType | undefined;

  @IsOptional()
  @IsEnum(EstablishmentStatus)
  status?: EstablishmentStatus | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(50000)
  maxDistance?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minRating?: number | undefined;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : value === 'true'))
  isVerified?: boolean | undefined;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : value === 'true'))
  acceptsReservations?: boolean | undefined;
}
