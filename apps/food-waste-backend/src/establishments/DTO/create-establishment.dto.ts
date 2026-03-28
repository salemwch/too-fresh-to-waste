import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';
import { EstablishmentType } from '../schemas/establishment.schema';

class AddressDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  street!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  city!: string;

  @IsString()
  @Matches(/^\d{4,5}$/, { message: 'Postal code must be 4 or  5 digits' })
  postalCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  country!: string;

  @IsObject()
  coordinates!: {
    type: string;
    coordinates: [number, number];
  };
}

class BusinessHoursDto {
  @IsObject()
  monday!: { open: string; close: string; closed: boolean };

  @IsObject()
  tuesday!: { open: string; close: string; closed: boolean };

  @IsObject()
  wednesday!: { open: string; close: string; closed: boolean };

  @IsObject()
  thursday!: { open: string; close: string; closed: boolean };

  @IsObject()
  friday!: { open: string; close: string; closed: boolean };

  @IsObject()
  saturday!: { open: string; close: string; closed: boolean };

  @IsObject()
  sunday!: { open: string; close: string; closed: boolean };
}

class LegalDocumentsDto {
  @IsOptional()
  @IsString()
  siret?: string;

  @IsOptional()
  @IsString()
  license?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  businessLicense?: string;

  @IsOptional()
  @IsString()
  foodSafetyLicense?: string;
}

export class CreateEstablishmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description!: string;

  @IsEnum(EstablishmentType)
  type!: EstablishmentType;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  /**
   * Establishment contact phone number
   * Must be in international format for business establishments
   * Will be normalized to E.164 format before storage
   */
  @IsString()
  @Transform(({ value }) => value?.trim())
  @IsValidPhoneNumber({
    defaultCountry: 'TN',
    allowNationalFormat: false, // Require international format for establishments
    required: true,
    message: 'Please provide a valid phone number in international format (e.g., +21620123456)',
  })
  phoneNumber!: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Establishment images (up to 8 images, JPEG/PNG/WebP, max 5MB each)',
    required: false,
    maxItems: 8,
    example: ['storefront.jpg', 'interior.jpg', 'menu.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  businessHours?: BusinessHoursDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalDocumentsDto)
  legalDocuments?: LegalDocumentsDto;

  @IsOptional()
  @IsBoolean()
  acceptsReservations?: boolean;
}
