import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
} from '@foodwaste/shared';
import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

/**
 * The first password of an admin-provisioned account (merchant staff, drivers).
 * Same shared policy as register, reset and change: it previously asked for 8
 * characters and no complexity, the weakest rule in the product on accounts
 * that handle money.
 */
export class ForcePasswordChangeDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_SHORT })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), { message: 'PASSWORD_POLICY' })
  newPassword!: string;
}
