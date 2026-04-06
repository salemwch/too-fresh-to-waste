import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';

import { EstablishmentsController } from './establishments.controller';
import { EstablishmentsService } from './establishments.service';
import { UserRegistrationListener } from './listeners/user-registration.listener';
import { Establishment, EstablishmentSchema } from './schemas/establishment.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([{ name: Establishment.name, schema: EstablishmentSchema }]),
  ],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService, UserRegistrationListener],
  exports: [EstablishmentsService, MongooseModule],
})
export class EstablishmentsModule {}
