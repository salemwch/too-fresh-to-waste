import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { FavoriteList, FavoriteListSchema } from './schemas/favorite-list.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: FavoriteList.name, schema: FavoriteListSchema },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService, MongooseModule],
})
export class FavoritesModule {}