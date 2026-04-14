import { IsEmail, IsOptional, IsString } from 'class-validator';

export class VerifyEmailDto {
  // Optional: web flow verifies by opaque hashed token alone.
  // Mobile POST still sends email for defense-in-depth binding.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  token!: string;
}
