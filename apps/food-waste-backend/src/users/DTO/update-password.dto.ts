import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_ERROR_MESSAGES,
  PASSWORD_SPECIAL_CHARS,
  buildPasswordRegex,
} from '@foodwaste/shared';
import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

import type { UpdatePasswordInput } from '@foodwaste/shared';

/**
 * Changing a password follows the same shared policy as register and reset.
 * This DTO used to accept 8 characters and an unanchored pattern, so one
 * account had a weaker rule on the one flow a logged-in user controls.
 */
export class UpdatePasswordDto implements UpdatePasswordInput {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'OldSecure@123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({
    description: `New password (min ${PASSWORD_MIN_LENGTH} chars, uppercase, lowercase, number, one of ${PASSWORD_SPECIAL_CHARS})`,
    example: 'NewSecure@12345',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_SHORT })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), { message: 'PASSWORD_POLICY' })
  newPassword!: string;
}
