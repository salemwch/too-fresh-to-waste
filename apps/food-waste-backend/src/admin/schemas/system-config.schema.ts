import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SystemConfigDocument = HydratedDocument<SystemConfig>;

export interface PlatformSettings {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requireEstablishmentApproval: boolean;
  maxOffersPerEstablishment: number;
  defaultOfferExpirationHours: number;
  minOrderValue: number;
  maxOrderValue: number;
  platformCommissionRate: number; // Percentage
  autoRefundTimeoutHours: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  adminEmailAlerts: boolean;
  orderConfirmationEnabled: boolean;
  orderReminderEnabled: boolean;
  promotionalEmailsEnabled: boolean;
}

export interface SecuritySettings {
  maxLoginAttempts: number;
  loginAttemptWindow: number; // Minutes
  accountLockoutDuration: number; // Minutes
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireUppercase: boolean;
  sessionTimeout: number; // Minutes
  twoFactorAuthRequired: boolean;
}

export interface PaymentSettings {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  minimumPayoutAmount: number;
  payoutFrequency: 'daily' | 'weekly' | 'monthly';
  automaticPayouts: boolean;
  refundProcessingDays: number;
}

@Schema({ timestamps: true, collection: 'system_configs' })
export class SystemConfig {
  @Prop({ required: true, unique: true, trim: true })
  configKey!: string;

  @Prop({ required: true })
  version!: string;

  @Prop({
    type: {
      maintenanceMode: { type: Boolean, default: false },
      allowNewRegistrations: { type: Boolean, default: true },
      requireEstablishmentApproval: { type: Boolean, default: true },
      maxOffersPerEstablishment: { type: Number, default: 50 },
      defaultOfferExpirationHours: { type: Number, default: 24 },
      minOrderValue: { type: Number, default: 1 },
      maxOrderValue: { type: Number, default: 1000 },
      platformCommissionRate: { type: Number, default: 15 },
      autoRefundTimeoutHours: { type: Number, default: 24 },
    },
    required: true,
  })
  platformSettings!: PlatformSettings;

  @Prop({
    type: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      pushNotificationsEnabled: { type: Boolean, default: true },
      adminEmailAlerts: { type: Boolean, default: true },
      orderConfirmationEnabled: { type: Boolean, default: true },
      orderReminderEnabled: { type: Boolean, default: true },
      promotionalEmailsEnabled: { type: Boolean, default: true },
    },
    required: true,
  })
  notificationSettings!: NotificationSettings;

  @Prop({
    type: {
      maxLoginAttempts: { type: Number, default: 10 },
      loginAttemptWindow: { type: Number, default: 15 },
      accountLockoutDuration: { type: Number, default: 30 },
      passwordMinLength: { type: Number, default: 8 },
      passwordRequireSpecialChar: { type: Boolean, default: true },
      passwordRequireNumbers: { type: Boolean, default: true },
      passwordRequireUppercase: { type: Boolean, default: true },
      sessionTimeout: { type: Number, default: 480 },
      twoFactorAuthRequired: { type: Boolean, default: false },
    },
    required: true,
  })
  securitySettings!: SecuritySettings;

  @Prop({
    type: {
      stripeEnabled: { type: Boolean, default: true },
      paypalEnabled: { type: Boolean, default: false },
      minimumPayoutAmount: { type: Number, default: 10 },
      payoutFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
      automaticPayouts: { type: Boolean, default: true },
      refundProcessingDays: { type: Number, default: 3 },
    },
    required: true,
  })
  paymentSettings!: PaymentSettings;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop()
  lastModifiedBy?: string;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);

// Additional indexes (configKey already has unique index from @Prop)
SystemConfigSchema.index({ isActive: 1 });
SystemConfigSchema.index({ version: 1 });
