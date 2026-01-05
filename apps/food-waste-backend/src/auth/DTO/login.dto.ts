import { IsEmail, IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
        format: 'email',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecureP@ssw0rd!',
        format: 'password',
        minLength: 8,
    })
    @IsString()
    password: string;

    @ApiPropertyOptional({
        description: 'Extend session duration to 7 days (instead of 1 day)',
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
