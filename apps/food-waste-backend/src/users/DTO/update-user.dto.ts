import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['password', 'email'] as const)
) {
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