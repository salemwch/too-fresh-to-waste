import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl } from 'class-validator';

import type { UpdateUserInput } from '@foodwaste/shared';

import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto
  extends PartialType(OmitType(CreateUserDto, ['password', 'email'] as const))
  implements UpdateUserInput
{
  /**
   * Phone field accepted from the frontend/shared UpdateProfileRequest type.
   * The controller remaps this to `phoneNumber` (the schema field) before
   * calling the service, so both names are valid at the API boundary.
   * Empty strings are converted to undefined and skipped.
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  phone?: string | undefined;

  @IsOptional()
  @IsString()
  avatar?: string | undefined;

  /**
   * Profile image URL
   * Can be a Supabase Storage URL or any valid image URL
   */
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'profileImage must be a valid URL' })
  profileImage?: string | undefined;

  @IsOptional()
  address?:
    | {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        coordinates?:
          | {
              type: string;
              coordinates: [number, number];
            }
          | undefined;
      }
    | undefined;
}
