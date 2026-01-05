import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, UserStatus } from '../schemas/user.schema';
import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';

export class CreateUserDto {
    @IsEmail()
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    @Transform(({ value }) => value?.trim())
    firstName: string;

    @IsString()
    @Transform(({ value }) => value?.trim())
    lastName: string;

    /**
     * Phone number validation using libphonenumber-js
     * Supports both international and national formats (Tunisia default)
     * Will be normalized to E.164 format before storage
     */
    @IsOptional()
    @IsString({ message: 'Phone number must be a string' })
    @Transform(({ value }) => value?.trim())
    @IsValidPhoneNumber({
        defaultCountry: 'TN',
        allowNationalFormat: true,
        required: true,
        message: 'Please provide a valid phone number (international format +... or national format)'
    })
    phoneNumber?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsString()
    isEmailVerified?: boolean;

    @IsOptional()
    @IsString()
    status?: UserStatus;
}