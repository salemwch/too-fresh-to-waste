import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { KonnectService } from './services/konnect.service';
import { paymentProviderProvider } from './services/payment-provider.factory';
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
  // KonnectService is provided through the factory, not directly: the token
  // stays the same for every consumer while the implementation behind it is
  // chosen by PAYMENT_PROVIDER. Listing KonnectService here as well would
  // shadow the factory and quietly restore the real client.
  providers: [SubscriptionService, paymentProviderProvider],
  exports: [SubscriptionService, KonnectService],
})
export class SubscriptionModule {}
