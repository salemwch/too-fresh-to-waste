import type { ForgotPasswordInput } from '@foodwaste/shared';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordInput {
  @IsEmail()
  email!: string;
}
