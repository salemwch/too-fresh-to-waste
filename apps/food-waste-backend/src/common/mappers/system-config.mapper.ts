import type { ISystemConfig, IConfigValidationResult } from '../interfaces/system-config.interface';

interface SystemConfigSource {
  _id?: { toString(): string } | undefined;
  id?: string | undefined;
  version: string;
  isActive: boolean;
  description?: string | undefined;
  lastModifiedBy?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  platformSettings?: {
    maintenanceMode?: boolean;
    allowNewRegistrations?: boolean;
    maxOrderValue?: number;
  };
  notificationSettings?: {
    emailEnabled?: boolean;
    pushNotificationsEnabled?: boolean;
    smsEnabled?: boolean;
  };
  securitySettings?: {
    passwordMinLength?: number;
    passwordRequireNumbers?: boolean;
    passwordRequireSpecialChar?: boolean;
    sessionTimeout?: number;
    maxLoginAttempts?: number;
    accountLockoutDuration?: number;
    twoFactorAuthRequired?: boolean;
  };
  paymentSettings?: {
    stripeEnabled?: boolean;
    paypalEnabled?: boolean;
    minimumPayoutAmount?: number;
    refundProcessingDays?: number;
    automaticPayouts?: boolean;
  };
}

export class SystemConfigMapper {
  static toInterface(document: SystemConfigSource | null | undefined): ISystemConfig {
    if (document === null || document === undefined) {
      throw new Error('Document cannot be null or undefined');
    }

    return {
      id: document._id?.toString() ?? document.id ?? '',
      version: document.version,
      isActive: document.isActive,
      platformSettings: {
        maintenanceMode: document.platformSettings?.maintenanceMode ?? false,
        allowNewRegistrations: document.platformSettings?.allowNewRegistrations ?? true,
        maxOrdersPerDay: document.platformSettings?.maxOrderValue ?? 1000,
        defaultCurrency: 'EUR',
        supportedLanguages: ['en', 'fr'],
        businessHours: {
          start: '08:00',
          end: '22:00',
          timezone: 'Europe/Paris',
        },
      },
      notificationSettings: {
        emailNotifications: document.notificationSettings?.emailEnabled ?? true,
        pushNotifications: document.notificationSettings?.pushNotificationsEnabled ?? true,
        smsNotifications: document.notificationSettings?.smsEnabled ?? false,
        emailTemplates: {},
        notificationRetryAttempts: 3,
        quietHours: {
          start: '22:00',
          end: '08:00',
        },
      },
      securitySettings: {
        passwordMinLength: document.securitySettings?.passwordMinLength ?? 8,
        passwordRequireNumbers: document.securitySettings?.passwordRequireNumbers ?? true,
        passwordRequireSymbols: document.securitySettings?.passwordRequireSpecialChar ?? true,
        sessionTimeoutMinutes: document.securitySettings?.sessionTimeout ?? 30,
        maxLoginAttempts: document.securitySettings?.maxLoginAttempts ?? 10,
        lockoutDurationMinutes: document.securitySettings?.accountLockoutDuration ?? 15,
        requireTwoFactor: document.securitySettings?.twoFactorAuthRequired ?? false,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: 5242880,
      },
      paymentSettings: {
        stripeEnabled: document.paymentSettings?.stripeEnabled ?? true,
        paypalEnabled: document.paymentSettings?.paypalEnabled ?? false,
        applePay: false,
        googlePay: false,
        minimumOrderAmount: document.paymentSettings?.minimumPayoutAmount ?? 5,
        processingFeePercentage: 2.9,
        refundProcessingDays: document.paymentSettings?.refundProcessingDays ?? 7,
        autoRefundEnabled: document.paymentSettings?.automaticPayouts ?? false,
      },
      ...(document.description !== undefined ? { description: document.description } : {}),
      createdBy: document.lastModifiedBy ?? '',
      createdAt: document.createdAt ?? new Date(),
      updatedAt: document.updatedAt ?? new Date(),
    };
  }

  static toInterfaceArray(documents: SystemConfigSource[]): ISystemConfig[] {
    return documents.map((doc) => this.toInterface(doc));
  }

  static toValidationResult(result: {
    isValid?: boolean;
    errors?: string[];
    warnings?: string[];
  }): IConfigValidationResult {
    return {
      isValid: result.isValid ?? false,
      errors: result.errors ?? [],
      warnings: result.warnings ?? [],
    };
  }
}
