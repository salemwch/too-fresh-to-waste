import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';

export class VerifyPhoneDto {
  /**
   * Phone number being verified
   * Must match the phone number that received the verification code
   */
  @ApiProperty({
    description: 'Phone number being verified (must match the number that received the code)',
    example: '+21620123456',
    required: true,
  })
  @IsString({ message: 'Phone number must be a string' })
  @Transform(({ value }) => value?.trim())
  @IsValidPhoneNumber({
    defaultCountry: 'TN',
    allowNationalFormat: true,
    required: true,
    message: 'Please provide a valid phone number',
  })
  phoneNumber!: string;

  /**
   * 6-digit verification code sent via SMS
   */
  @ApiProperty({
    description: '6-digit verification code sent to the phone number',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    required: true,
  })
  @IsString({ message: 'Verification code must be a string' })
  @Transform(({ value }) => value?.trim())
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only digits' })
  code!: string;
}
