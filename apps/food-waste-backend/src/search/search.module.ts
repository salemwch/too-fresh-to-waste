import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';

import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';

import { User, UserSchema } from '../users/schemas/user.schema';

import { SearchProcessor } from './processors/search.processor';
import { PopularSearch, PopularSearchSchema } from './schemas/popular-search.schema';
import { SearchQuery, SearchQuerySchema } from './schemas/search-query.schema';
import { SearchSuggestion, SearchSuggestionSchema } from './schemas/search-suggestion.schema';
import { SearchController } from './search.controller';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { SearchCacheService } from './services/search-cache.service';
import { SearchIndexService } from './services/search-index.service';
import { SearchSuggestionService } from './services/search-suggestion.service';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: SearchQuery.name, schema: SearchQuerySchema },
      { name: SearchSuggestion.name, schema: SearchSuggestionSchema },
      { name: PopularSearch.name, schema: PopularSearchSchema },
    ]),
    BullModule.registerQueue(
      {
        name: 'search-indexing',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
        },
      },
      {
        name: 'search-analytics',
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 5,
          attempts: 2,
        },
      },
    ),
  ],
  controllers: [SearchController],
  providers: [
    SearchCacheService,
    SearchAnalyticsService,
    SearchIndexService,
    SearchSuggestionService,
    SearchProcessor,
  ],
  exports: [SearchSuggestionService, SearchAnalyticsService, SearchIndexService],
})
export class SearchModule {}
