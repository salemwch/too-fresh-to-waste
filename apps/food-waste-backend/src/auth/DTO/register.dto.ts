import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_SPECIAL_CHARS,
    PASSWORD_ERROR_MESSAGES,
    buildPasswordRegex,
} from '@foodwaste/shared';
import { UserRole } from '../../users/schemas/user.schema';
import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';
import { SanitizeEmail, SanitizeText, SanitizePhoneNumber } from '../../common/decorators/sanitize.decorator';

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
export class RegisterDto {
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
    email: string;

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
    password: string;

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
    firstName: string;

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
    lastName: string;

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
        description: 'Phone number in international (+21620123456) or national format (20123456). Optional during registration, required for placing orders.',
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
        message: 'Please provide a valid phone number (international format +... or national format)'
    })
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'User role (defaults to "consumer" if not specified)',
        enum: UserRole,
        example: UserRole.CONSUMER,
        default: UserRole.CONSUMER,
    })
    @IsOptional()
    @IsEnum(UserRole, { message: 'Invalid user role' })
    role?: UserRole;

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
    referralCode?: string;
}