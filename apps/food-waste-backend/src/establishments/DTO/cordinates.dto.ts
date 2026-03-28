import { Type } from 'class-transformer';
import { IsString, IsArray } from 'class-validator';

export class CoordinatesDto {
  @IsString()
  type!: string;

  @IsArray()
  @Type(() => Number)
  coordinates!: number[];
}
