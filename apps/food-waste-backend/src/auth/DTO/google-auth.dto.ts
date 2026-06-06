import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiPropertyOptional({ description: 'Referral code from invite link' })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Referral code must be at least 4 characters' })
  @MaxLength(20, { message: 'Referral code cannot exceed 20 characters' })
  referralCode?: string | undefined;
}
