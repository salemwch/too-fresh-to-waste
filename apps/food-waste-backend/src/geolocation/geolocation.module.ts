import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { EstablishmentsModule } from '../establishments/establishments.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { OffersModule } from '../offers/offers.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/user.module';

import { GeolocationController } from './controllers/geolocation.controller';
import { ProximitySearchController } from './controllers/proximity-search.controller';
import { UserLocationController } from './controllers/user-location.controller';
import { GeoapifyService } from './services/geoapify.service';
import { GeolocationService } from './services/geolocation.service';
import { GooglePlacesService } from './services/google-places.service';
import { ProximitySearchService } from './services/proximity-search.service';
import { UserLocationService } from './services/user-location.service';

// Controllers

// Modules

@Module({
  imports: [
    // HTTP client for external API calls
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),

    // Register Mongoose schemas
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),

    // Import related modules (using forwardRef to avoid circular dependencies)
    forwardRef(() => UsersModule),
    forwardRef(() => EstablishmentsModule),
    forwardRef(() => OffersModule),
  ],

  controllers: [GeolocationController, ProximitySearchController, UserLocationController],

  providers: [
    GeolocationService,
    ProximitySearchService,
    UserLocationService,
    GooglePlacesService,
    GeoapifyService,
  ],

  exports: [
    // Export services for use in other modules
    GeolocationService,
    ProximitySearchService,
    UserLocationService,
    GooglePlacesService,
    GeoapifyService,

    // Export MongooseModule for schema access
    MongooseModule,
  ],
})
export class GeolocationModule {}
