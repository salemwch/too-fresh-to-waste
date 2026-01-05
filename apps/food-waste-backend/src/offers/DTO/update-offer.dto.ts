import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateOfferDto } from './create-offer.dto';
import { OfferStatus } from '../schemas/offer.schema';

export class UpdateOfferDto extends PartialType(CreateOfferDto) {
    @IsOptional()
    @IsEnum(OfferStatus)
    status?: OfferStatus;
}