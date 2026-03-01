import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { FavoriteEventsListener } from './listeners/favorite-events.listener';
import { AdminEstablishmentEventsListener } from './listeners/admin-establishment-events.listener';
import { CommonModule } from '../common/common.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { EstablishmentsModule } from '../establishments/establishments.module';

// Note: ScheduleModule.forRoot() is already called in AppModule
// Cron decorators in OffersService will work automatically

@Module({
    imports: [
        CommonModule,
        FavoritesModule, // For isFavorite computation via FavoritesService
        EstablishmentsModule, // For ownership + approval validation on offer creation
        MongooseModule.forFeature([
            { name: Offer.name, schema: OfferSchema },
        ]),
        // ✅ MULTER CONFIGURATION: Handle file uploads with proper limits
        MulterModule.register({
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB per file (was ~1MB default)
                files: 5, // Max 5 files per request
            },
            fileFilter: (req, file, callback) => {
                // Only allow image files
                if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
                    return callback(
                        new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'),
                        false,
                    );
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
    exports: [OffersService],
})
export class OffersModule { }