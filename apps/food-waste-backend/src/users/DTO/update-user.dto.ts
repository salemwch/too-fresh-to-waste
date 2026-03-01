import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['password', 'email'] as const)
) {
    /**
     * Phone field accepted from the frontend/shared UpdateProfileRequest type.
     * The controller remaps this to `phoneNumber` (the schema field) before
     * calling the service, so both names are valid at the API boundary.
     * Empty strings are converted to undefined and skipped.
     */
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
    phone?: string;

    @IsOptional()
    @IsString()
    avatar?: string;

    /**
     * Profile image URL
     * Can be a Firebase Storage URL or any valid image URL
     */
    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'profileImage must be a valid URL' })
    profileImage?: string;

    @IsOptional()
    address?: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        coordinates?: {
            type: string;
            coordinates: [number, number];
        };
    };
}