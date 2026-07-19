import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { PrizeClaimStatus } from '../../loyalty/schemas/prize-claim.schema';

export class UpdatePrizeClaimDto {
  @ApiProperty({
    enum: [PrizeClaimStatus.VERIFIED, PrizeClaimStatus.DELIVERED, PrizeClaimStatus.REJECTED],
  })
  @IsEnum(PrizeClaimStatus)
  status!: PrizeClaimStatus;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}
