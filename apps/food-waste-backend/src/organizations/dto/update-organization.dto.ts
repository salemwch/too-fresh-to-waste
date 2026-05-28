import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Movenpick Hotels & Resorts Tunisia' })
  @IsOptional()
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
