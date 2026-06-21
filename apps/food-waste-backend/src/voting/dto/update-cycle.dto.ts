import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';

import { CreatePrizeOptionDto } from './create-cycle.dto';

export class UpdateCycleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  cycleStartDate?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  cycleEndDate?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  communityGoalTarget?: number | undefined;

  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  minimumBags?: number | undefined;

  @ApiProperty({ required: false, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  recipientCount?: number | undefined;

  @ApiProperty({ required: false, type: [CreatePrizeOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @Type(() => CreatePrizeOptionDto)
  prizes?: CreatePrizeOptionDto[] | undefined;
}
