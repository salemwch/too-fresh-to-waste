import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { KonnectService } from './services/konnect.service';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, KonnectService],
  exports: [SubscriptionService, KonnectService],
})
export class SubscriptionModule {}
