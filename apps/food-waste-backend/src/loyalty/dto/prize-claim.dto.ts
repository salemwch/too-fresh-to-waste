import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimDiscountDto {
  @ApiProperty({ description: 'ID of the partner establishment for the discount' })
  @IsNotEmpty()
  @IsMongoId()
  establishmentId!: string;
}
