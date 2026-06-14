import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';

import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { FavoriteList, FavoriteListSchema } from './schemas/favorite-list.schema';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';

@Module({
  imports: [
    CommonModule, // Provides EventBusService
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: FavoriteList.name, schema: FavoriteListSchema },
      { name: Offer.name, schema: OfferSchema }, // Required for populating offer details
      { name: Establishment.name, schema: EstablishmentSchema }, // Required for populating establishment details
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService, AdminUserEventsListener],
  exports: [FavoritesService, MongooseModule],
})
export class FavoritesModule {}
