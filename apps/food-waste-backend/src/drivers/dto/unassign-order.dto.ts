import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnassignOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
