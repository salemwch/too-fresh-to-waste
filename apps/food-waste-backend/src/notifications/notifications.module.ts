import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { User, UserSchema } from '../users/schemas/user.schema';

import { NOTIFICATION_JOB_OPTIONS, NOTIFICATION_QUEUE } from './notifications.constants';
import { NotificationProcessor } from './processors/notification.processor';

import { NotificationsController } from './controllers/notifications.controller';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { TrialExpiryListener } from './listeners/trial-expiry.listener';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './schemas/notification-preference.schema';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from './schemas/notification-template.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { OptOutAudit, OptOutAuditSchema } from './schemas/opt-out-audit.schema';
import { OptOutRecord, OptOutRecordSchema } from './schemas/opt-out-record.schema';
import { EmailNotificationService } from './services/email-notification.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationService } from './services/notification.service';
import { OptOutManagerService } from './services/opt-out-manager.service';
import { PhoneValidatorService } from './services/phone-validator.service';
import { PushNotificationService } from './services/push-notification.service';
import { SmsNotificationService } from './services/sms-notification.service';
import { TemplateService } from './services/template.service';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    CommonModule,
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
    }),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: OptOutRecord.name, schema: OptOutRecordSchema },
      { name: OptOutAudit.name, schema: OptOutAuditSchema },
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
    TrialExpiryListener,
    AdminUserEventsListener,
    NotificationProcessor,
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
    MongooseModule,
  ],
})
export class NotificationsModule {}
