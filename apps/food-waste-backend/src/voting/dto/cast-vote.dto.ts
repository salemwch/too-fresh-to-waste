import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CastVoteDto {
  @ApiProperty({ description: 'The ObjectId of the prize to vote for' })
  @IsMongoId()
  prizeId!: string;
}
