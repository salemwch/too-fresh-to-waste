import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EstablishmentsService } from './establishments.service';
import { Establishment, EstablishmentSchema } from './schemas/establishment.schema';
import { EstablishmentsController } from './establishments.controller';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        CommonModule,
        MongooseModule.forFeature([
            { name: Establishment.name, schema: EstablishmentSchema }
        ]),
    ],
    controllers: [EstablishmentsController],
    providers: [EstablishmentsService],
    exports: [EstablishmentsService],
})
export class EstablishmentsModule { }