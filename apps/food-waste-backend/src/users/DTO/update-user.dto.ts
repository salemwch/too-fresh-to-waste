import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['password', 'email'] as const)
) {
    @IsOptional()
    @IsString()
    avatar?: string;

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