import type { VerifyEmailInput } from '@foodwaste/shared';
import { IsEmail, IsString } from 'class-validator';

export class VerifyEmailDto implements VerifyEmailInput {
  @IsEmail()
  email!: string;

  @IsString()
  token!: string;
}
