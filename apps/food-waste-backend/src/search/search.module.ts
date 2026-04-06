import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { SearchProcessor } from './processors/search.processor';
import { PopularSearch, PopularSearchSchema } from './schemas/popular-search.schema';
import { SearchQuery, SearchQuerySchema } from './schemas/search-query.schema';
import { SearchSuggestion, SearchSuggestionSchema } from './schemas/search-suggestion.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { SearchCacheService } from './services/search-cache.service';
import { SearchIndexService } from './services/search-index.service';
import { SearchSuggestionService } from './services/search-suggestion.service';

// Import existing schemas

// New search-specific schemas

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: SearchQuery.name, schema: SearchQuerySchema },
      { name: SearchSuggestion.name, schema: SearchSuggestionSchema },
      { name: PopularSearch.name, schema: PopularSearchSchema },
    ]),
    BullModule.registerQueueAsync({
      name: 'search-indexing',
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') ?? 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10) || 6379,
          password: configService.get('REDIS_PASSWORD'),
          username: configService.get('REDIS_USERNAME'),
          // Explicitly disable TLS for search indexing queue
          tls: undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'search-analytics',
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') ?? 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10) || 6379,
          password: configService.get('REDIS_PASSWORD'),
          username: configService.get('REDIS_USERNAME'),
          // Explicitly disable TLS for search analytics queue
          tls: undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
        },
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 5,
          attempts: 2,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchCacheService,
    SearchAnalyticsService,
    SearchIndexService,
    SearchSuggestionService,
    SearchProcessor,
  ],
  exports: [SearchService, SearchSuggestionService, SearchAnalyticsService, SearchIndexService],
})
export class SearchModule {}
