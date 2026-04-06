import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';

import type { UpdateOfferInput } from '@foodwaste/shared';

import { OfferStatus } from '../schemas/offer.schema';

import { CreateOfferDto } from './create-offer.dto';

export class UpdateOfferDto extends PartialType(CreateOfferDto) implements UpdateOfferInput {
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus | undefined;
}
