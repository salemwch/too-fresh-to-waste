import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimSmartphoneDto {
  // No fields — rank validated server-side
}

export class ClaimDiscountDto {
  @ApiProperty({ description: 'ID of the partner establishment for the discount' })
  @IsNotEmpty()
  @IsMongoId()
  establishmentId!: string;
}

export class PrizeClaimResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() prizeType!: string;
  @ApiProperty() status!: string;
  @ApiProperty() rank!: number;
  @ApiProperty() totalPoints!: number;
  @ApiProperty() cycleNumber!: number;
  @ApiPropertyOptional() establishmentId?: string;
  @ApiPropertyOptional() establishmentName?: string;
  @ApiPropertyOptional() adminNotes?: string;
  @ApiPropertyOptional() verifiedAt?: string;
  @ApiPropertyOptional() deliveredAt?: string;
  @ApiProperty() createdAt!: string;
}
