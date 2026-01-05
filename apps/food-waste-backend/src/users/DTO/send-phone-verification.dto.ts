import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';

export class SendPhoneVerificationDto {
    /**
     * Phone number to verify
     * Must be in international format for best compatibility
     * Will be normalized to E.164 format before processing
     */
    @ApiProperty({
        description: 'Phone number to verify in international format',
        example: '+21620123456',
        required: true
    })
    @IsString({ message: 'Phone number must be a string' })
    @Transform(({ value }) => value?.trim())
    @IsValidPhoneNumber({
        defaultCountry: 'TN',
        allowNationalFormat: true,
        required: true,
        message: 'Please provide a valid phone number (international format +... or national format)'
    })
    phoneNumber: string;

    /**
     * Verification method - SMS or Voice Call
     * Default: SMS
     */
    @ApiProperty({
        description: 'Verification method (SMS or voice call)',
        enum: ['sms', 'voice'],
        default: 'sms',
        required: false
    })
    @IsOptional()
    @IsEnum(['sms', 'voice'], { message: 'Verification method must be either "sms" or "voice"' })
    method?: 'sms' | 'voice' = 'sms';
}
