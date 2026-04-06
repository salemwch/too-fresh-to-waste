import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
} from '@foodwaste/shared';
import type { ResetPasswordInput } from '@foodwaste/shared';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordInput {
  @IsEmail()
  email!: string;

  @IsString()
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_SHORT })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), {
    message:
      'Password must contain at least one uppercase, one lowercase, one number, and one special character',
  })
  newPassword!: string;
}
