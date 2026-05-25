import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

import type { CreateUserInput } from '@foodwaste/shared';

import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';
import { UserRole, UserStatus } from '../schemas/user.schema';

function trimTransform({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizedEmailTransform({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.toLowerCase().trim() : value;
}

export class CreateUserDto implements CreateUserInput {
  @IsEmail()
  @Transform(normalizedEmailTransform)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Transform(trimTransform)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimTransform)
  lastName?: string;

  /**
   * Phone number validation using libphonenumber-js
   * Supports both international and national formats (Tunisia default)
   * Will be normalized to E.164 format before storage
   */
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @Transform(trimTransform)
  @IsValidPhoneNumber({
    defaultCountry: 'TN',
    allowNationalFormat: true,
    required: true,
    message: 'Please provide a valid phone number (international format +... or national format)',
  })
  phoneNumber?: string | undefined;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole | undefined;

  @IsOptional()
  @IsString()
  isEmailVerified?: boolean | undefined;

  @IsOptional()
  @IsString()
  status?: UserStatus | undefined;
}
