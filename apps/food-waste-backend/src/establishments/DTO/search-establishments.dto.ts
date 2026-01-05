import { IsOptional, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstablishmentType, EstablishmentStatus } from '../schemas/establishment.schema';

export class SearchEstablishmentsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(EstablishmentType)
    type?: EstablishmentType;

    @IsOptional()
    @IsEnum(EstablishmentStatus)
    status?: EstablishmentStatus;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(100)
    @Max(50000)
    maxDistance?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    minRating?: number;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isVerified?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    acceptsReservations?: boolean;
}