import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommonModule } from '../common/common.module';

// Schemas
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationPreference, NotificationPreferenceSchema } from './schemas/notification-preference.schema';
import { NotificationTemplate, NotificationTemplateSchema } from './schemas/notification-template.schema';
import { OptOutRecord, OptOutRecordSchema } from './schemas/opt-out-record.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';

// Services
import { NotificationService } from './services/notification.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { PushNotificationService } from './services/push-notification.service';
import { EmailNotificationService } from './services/email-notification.service';
import { SmsNotificationService } from './services/sms-notification.service';
import { TemplateService } from './services/template.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { PhoneValidatorService } from './services/phone-validator.service';
import { OptOutManagerService } from './services/opt-out-manager.service';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: OptOutRecord.name, schema: OptOutRecordSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationPreferencesService,
    PushNotificationService,
    EmailNotificationService,
    SmsNotificationService,
    TemplateService,
    NotificationAnalyticsService,
    PhoneValidatorService,
    OptOutManagerService,
  ],
  exports: [
    NotificationService,
    NotificationPreferencesService,
    PushNotificationService,
    EmailNotificationService,
    SmsNotificationService,
    TemplateService,
    NotificationAnalyticsService,
    PhoneValidatorService,
    OptOutManagerService,
    MongooseModule
  ],
})
export class NotificationsModule {}