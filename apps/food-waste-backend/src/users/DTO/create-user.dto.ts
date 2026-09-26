import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, buildPasswordRegex } from '@foodwaste/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

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
  @MaxLength(255)
  @Transform(normalizedEmailTransform)
  email!: string;

  // The same rule as every other password input (register, reset, change).
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(buildPasswordRegex(), { message: 'PASSWORD_POLICY' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimTransform)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
