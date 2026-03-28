import type { SystemConfigDocument } from '../../admin/schemas/system-config.schema';
import type { ISystemConfig, IConfigValidationResult } from '../interfaces/system-config.interface';

export class SystemConfigMapper {
  static toInterface(document: SystemConfigDocument): ISystemConfig {
    if (!document) {
      throw new Error('Document cannot be null or undefined');
    }

    const doc = document as unknown as { createdAt?: Date; updatedAt?: Date };

    return {
      id: document._id?.toString() || (document as unknown as { id?: string }).id || '',
      version: document.version,
      isActive: document.isActive,
      platformSettings: {
        maintenanceMode: document.platformSettings?.maintenanceMode || false,
        allowNewRegistrations: document.platformSettings?.allowNewRegistrations ?? true,
        maxOrdersPerDay: document.platformSettings?.maxOrderValue || 1000,
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
        passwordMinLength: document.securitySettings?.passwordMinLength || 8,
        passwordRequireNumbers: document.securitySettings?.passwordRequireNumbers ?? true,
        passwordRequireSymbols: document.securitySettings?.passwordRequireSpecialChar ?? true,
        sessionTimeoutMinutes: document.securitySettings?.sessionTimeout || 30,
        maxLoginAttempts: document.securitySettings?.maxLoginAttempts || 10,
        lockoutDurationMinutes: document.securitySettings?.accountLockoutDuration || 15,
        requireTwoFactor: document.securitySettings?.twoFactorAuthRequired || false,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: 5242880,
      },
      paymentSettings: {
        stripeEnabled: document.paymentSettings?.stripeEnabled ?? true,
        paypalEnabled: document.paymentSettings?.paypalEnabled ?? false,
        applePay: false,
        googlePay: false,
        minimumOrderAmount: document.paymentSettings?.minimumPayoutAmount || 5,
        processingFeePercentage: 2.9,
        refundProcessingDays: document.paymentSettings?.refundProcessingDays || 7,
        autoRefundEnabled: document.paymentSettings?.automaticPayouts ?? false,
      },
      ...(document.description !== undefined ? { description: document.description } : {}),
      createdBy: document.lastModifiedBy || '',
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
    };
  }

  static toInterfaceArray(documents: SystemConfigDocument[]): ISystemConfig[] {
    return documents.map((doc) => this.toInterface(doc));
  }

  static toValidationResult(result: {
    isValid?: boolean;
    errors?: string[];
    warnings?: string[];
  }): IConfigValidationResult {
    return {
      isValid: result.isValid || false,
      errors: result.errors || [],
      warnings: result.warnings || [],
    };
  }
}
