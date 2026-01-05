import { IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
    @IsString()
    type: string;

    @IsArray()
    @Type(() => Number)
    coordinates: number[];
}
