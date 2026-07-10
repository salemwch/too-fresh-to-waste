import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class ClaimVotingPrizeDto {
  @ApiProperty({
    description: 'Establishment the winner chooses for their 10% discount voucher',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsMongoId()
  establishmentId!: string;
}
