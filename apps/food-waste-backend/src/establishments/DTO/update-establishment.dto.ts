import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateEstablishmentDto } from './create-establishment.dto';
import { EstablishmentStatus } from '../schemas/establishment.schema';

export class UpdateEstablishmentDto extends PartialType(CreateEstablishmentDto) {
    @IsOptional()
    @IsEnum(EstablishmentStatus)
    status?: EstablishmentStatus;
}