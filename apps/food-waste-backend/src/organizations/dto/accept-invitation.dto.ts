import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
} from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token from the email link' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'First name of the new location manager' })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ description: 'Last name of the new location manager' })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({
    description: `Password (NIST 800-63B). Must contain uppercase + lowercase + number + special char`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_SHORT })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), { message: 'PASSWORD_POLICY' })
  password!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
