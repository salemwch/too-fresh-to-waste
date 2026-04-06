import type { CoordinatesInput } from '@foodwaste/shared';
import { Type } from 'class-transformer';
import { IsString, IsArray } from 'class-validator';

export class CoordinatesDto implements CoordinatesInput {
  @IsString()
  type!: string;

  @IsArray()
  @Type(() => Number)
  coordinates!: number[];
}
