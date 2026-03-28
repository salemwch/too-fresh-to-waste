import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecureP@ssw0rd!',
    format: 'password',
    minLength: 8,
  })
  @IsString()
  password!: string;

  @ApiPropertyOptional({
    description: 'Keep session active for 30 days (default: 7 days)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  /**
   * CAPTCHA token from client (required after failed login attempts)
   * PRODUCTION-READY IMPROVEMENT
   */
  @ApiPropertyOptional({
    description: 'CAPTCHA verification token (required after 3 failed login attempts)',
    example: 'captcha_token_abc123xyz',
  })
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
