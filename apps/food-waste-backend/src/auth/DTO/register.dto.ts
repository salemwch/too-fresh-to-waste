import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SPECIAL_CHARS,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
  UserRole,
} from '@foodwaste/shared';
import type { RegisterInput } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';

import {
  SanitizeEmail,
  SanitizeText,
  SanitizePhoneNumber,
} from '../../common/decorators/sanitize.decorator';
import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';

/**
 * Nested DTO for address components from Google Places API
 */
class AddressComponentsDto {
  @ApiPropertyOptional({ example: 'Avenue Habib Bourguiba' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Street cannot exceed 200 characters' })
  street?: string | undefined;

  @ApiPropertyOptional({ example: 'Tunis' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'City cannot exceed 100 characters' })
  city?: string | undefined;

  @ApiPropertyOptional({ example: '1000' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Postal code cannot exceed 20 characters' })
  postalCode?: string | undefined;

  @ApiPropertyOptional({ example: 'Tunisia' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Country cannot exceed 100 characters' })
  country?: string | undefined;
}

/**
 * Business information captured from Google Places during merchant signup.
 * Validated with class-validator decorators for nested DTO support.
 */
class BusinessInfoDto {
  @ApiProperty({
    description: 'Business name from Google Places',
    example: 'Cafe De Tunis',
    minLength: 2,
    maxLength: 100,
  })
  @SanitizeText()
  @IsString({ message: 'Business name must be a string' })
  @MinLength(2, { message: 'Business name must be at least 2 characters' })
  @MaxLength(100, { message: 'Business name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    description: 'Google Place ID',
    example: 'ChIJZa7pLMDy4RIRkHFwgn4ruUc',
  })
  @IsString({ message: 'Google Place ID must be a string' })
  @MinLength(1, { message: 'Google Place ID is required' })
  @MaxLength(300, { message: 'Google Place ID cannot exceed 300 characters' })
  googlePlaceId!: string;

  @ApiProperty({ description: 'Latitude', example: 36.8065 })
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude!: number;

  @ApiProperty({ description: 'Longitude', example: 10.1815 })
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude!: number;

  @ApiProperty({
    description: 'Full formatted address from Google Places',
    example: 'Avenue Habib Bourguiba, Tunis 1000, Tunisia',
  })
  @SanitizeText()
  @IsString({ message: 'Formatted address must be a string' })
  @MinLength(1, { message: 'Formatted address is required' })
  @MaxLength(500, { message: 'Formatted address cannot exceed 500 characters' })
  formattedAddress!: string;

  @ApiPropertyOptional({ description: 'Parsed address components' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressComponentsDto)
  addressComponents?: AddressComponentsDto | undefined;

  @ApiPropertyOptional({
    description: 'Google Place types for mapping to EstablishmentType',
    example: ['restaurant', 'food', 'point_of_interest'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[] | undefined;
}

/**
 * SECURITY: Decorator order is CRITICAL
 *
 * Execution order (class-transformer → class-validator):
 * 1. @Sanitize* decorators (via @Transform) - RUN FIRST
 * 2. @Is* validators - RUN SECOND
 *
 * This prevents XSS payloads from bypassing validation.
 * Reference: PRODUCTION_READINESS_AUDIT_REPORT.md:244-246
 */
export class RegisterDto implements RegisterInput {
  /**
   * Email sanitization runs BEFORE validation
   * Prevents: <script>alert('xss')</script>test@example.com
   */
  @ApiProperty({
    description: 'User email address (must be unique)',
    example: 'john.doe@example.com',
    format: 'email',
    minLength: 5,
    maxLength: 255,
  })
  @SanitizeEmail() // STEP 1: Clean input
  @IsEmail({}, { message: 'Please provide a valid email address' }) // STEP 2: Validate
  email!: string;

  /**
   * Password - no sanitization to preserve special characters
   * User intention: passwords should contain exactly what user typed
   */
  @ApiProperty({
    description: `Secure password following NIST 800-63B guidelines. Must contain:\n- At least ${PASSWORD_MIN_LENGTH} characters\n- Uppercase letter\n- Lowercase letter\n- Number\n- Special character (${PASSWORD_SPECIAL_CHARS})`,
    example: 'SecureP@ssw0rd!',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_SHORT })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), {
    message: `Password must contain at least one uppercase, one lowercase, one number, and one special character (${PASSWORD_SPECIAL_CHARS})`,
  })
  password!: string;

  /**
   * Name fields: sanitize to prevent HTML injection in error messages or logs
   */
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 50,
  })
  @SanitizeText() // STEP 1: Encode HTML entities, trim
  @IsString({ message: 'First name must be a string' })
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50,
  })
  @SanitizeText() // STEP 1: Encode HTML entities, trim
  @IsString({ message: 'Last name must be a string' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  lastName!: string;

  /**
   * Phone number validation using libphonenumber-js
   * Supports international format with country code (+1234567890)
   * Or national format if default country is configured
   *
   * Examples of valid formats:
   * - International: +12133734253, +216 20 123 456
   * - National (with default country): (213) 373-4253, 20 123 456
   */
  @ApiPropertyOptional({
    description:
      'Phone number in international (+21620123456) or national format (20123456). Optional during registration, required for placing orders.',
    example: '+21620123456',
    pattern: '^\\+?[1-9]\\d{1,14}$',
  })
  @IsOptional()
  @SanitizePhoneNumber() // STEP 1: Remove non-digit chars except +
  @IsString({ message: 'Phone number must be a string' })
  @IsValidPhoneNumber({
    // Tunisia as default country for national numbers
    // Users can still provide international numbers with +
    defaultCountry: 'TN',
    // Allow both formats: +216XXXXXXXX or XXXXXXXX
    allowNationalFormat: true,
    // Phone number is now optional during registration
    required: false,
    // Custom error message
    message: 'Please provide a valid phone number (international format +... or national format)',
  })
  phoneNumber?: string | undefined;

  @ApiPropertyOptional({
    description: 'User role (defaults to "consumer" if not specified)',
    enum: UserRole,
    example: UserRole.CONSUMER,
    default: UserRole.CONSUMER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role?: UserRole | undefined;

  @ApiPropertyOptional({
    description: 'Referral code from an existing user (for friend/business referral rewards)',
    example: 'JOHN1234',
    minLength: 4,
    maxLength: 20,
  })
  @IsOptional()
  @SanitizeText()
  @IsString({ message: 'Referral code must be a string' })
  @MinLength(4, { message: 'Referral code must be at least 4 characters' })
  @MaxLength(20, { message: 'Referral code cannot exceed 20 characters' })
  referralCode?: string | undefined;

  @ApiPropertyOptional({
    description: 'Business information from Google Places (required for merchant signup)',
    type: BusinessInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessInfoDto)
  businessInfo?: BusinessInfoDto | undefined;
}
