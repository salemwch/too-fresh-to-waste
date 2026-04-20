import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { CommonModule } from '../common/common.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { SustainabilityModule } from '../sustainability/sustainability.module';

import { AdminEstablishmentEventsListener } from './listeners/admin-establishment-events.listener';
import { FavoriteEventsListener } from './listeners/favorite-events.listener';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer, OfferSchema } from './schemas/offer.schema';

// Note: ScheduleModule.forRoot() is already called in AppModule
// Cron decorators in OffersService will work automatically

@Module({
  imports: [
    CommonModule,
    EstablishmentsModule, // For ownership + approval validation on offer creation
    SustainabilityModule, // For StreakService — records listing streak on offer creation
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    // ✅ MULTER CONFIGURATION: Handle file uploads with proper limits
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file (was ~1MB default)
        files: 5, // Max 5 files per request
      },
      fileFilter: (_req, file, callback) => {
        // Only allow image files
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
          return callback(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
        }
        callback(null, true);
      },
    }),
  ],
  controllers: [OffersController],
  providers: [
    OffersService,
    FavoriteEventsListener, // Event listener for favorite-related events
    AdminEstablishmentEventsListener, // Event listener for admin establishment events
  ],
  exports: [OffersService, MongooseModule],
})
export class OffersModule {}
