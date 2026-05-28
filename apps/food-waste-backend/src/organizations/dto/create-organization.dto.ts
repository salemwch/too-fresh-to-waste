import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization / brand name',
    example: 'Movenpick Tunisia',
    minLength: 2,
    maxLength: 100,
  })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
