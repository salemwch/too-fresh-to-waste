import type { UpdateEstablishmentInput } from '@foodwaste/shared';
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';

import { EstablishmentStatus } from '../schemas/establishment.schema';

import { CreateEstablishmentDto } from './create-establishment.dto';

export class UpdateEstablishmentDto
  extends PartialType(CreateEstablishmentDto)
  implements UpdateEstablishmentInput
{
  @IsOptional()
  @IsEnum(EstablishmentStatus)
  status?: EstablishmentStatus | undefined;
}
