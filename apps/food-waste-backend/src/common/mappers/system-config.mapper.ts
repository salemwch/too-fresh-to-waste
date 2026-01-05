import { ISystemConfig, IConfigValidationResult } from '../interfaces/system-config.interface';

export class SystemConfigMapper {
  static toInterface(document: any): ISystemConfig {
    if (!document) {
      throw new Error('Document cannot be null or undefined');
    }

    return {
      id: document._id?.toString() || document.id,
      version: document.version,
      isActive: document.isActive,
      platformSettings: {
        maintenanceMode: document.platformSettings?.maintenanceMode || false,
        allowNewRegistrations: document.platformSettings?.allowNewRegistrations ?? true,
        maxOrdersPerDay: document.platformSettings?.maxOrdersPerDay || 1000,
        defaultCurrency: document.platformSettings?.defaultCurrency || 'EUR',
        supportedLanguages: document.platformSettings?.supportedLanguages || ['en', 'fr'],
        businessHours: {
          start: document.platformSettings?.businessHours?.start || '08:00',
          end: document.platformSettings?.businessHours?.end || '22:00',
          timezone: document.platformSettings?.businessHours?.timezone || 'Europe/Paris',
        },
      },
      notificationSettings: {
        emailNotifications: document.notificationSettings?.emailNotifications ?? true,
        pushNotifications: document.notificationSettings?.pushNotifications ?? true,
        smsNotifications: document.notificationSettings?.smsNotifications ?? true,
        emailTemplates: document.notificationSettings?.emailTemplates || {},
        notificationRetryAttempts: document.notificationSettings?.notificationRetryAttempts || 3,
        quietHours: {
          start: document.notificationSettings?.quietHours?.start || '22:00',
          end: document.notificationSettings?.quietHours?.end || '08:00',
        },
      },
      securitySettings: {
        passwordMinLength: document.securitySettings?.passwordMinLength || 8,
        passwordRequireNumbers: document.securitySettings?.passwordRequireNumbers ?? true,
        passwordRequireSymbols: document.securitySettings?.passwordRequireSymbols ?? true,
        sessionTimeoutMinutes: document.securitySettings?.sessionTimeoutMinutes || 30,
        maxLoginAttempts: document.securitySettings?.maxLoginAttempts || 5,
        lockoutDurationMinutes: document.securitySettings?.lockoutDurationMinutes || 15,
        requireTwoFactor: document.securitySettings?.requireTwoFactor || false,
        allowedFileTypes: document.securitySettings?.allowedFileTypes || ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: document.securitySettings?.maxFileSize || 5242880, // 5MB
      },
      paymentSettings: {
        stripeEnabled: document.paymentSettings?.stripeEnabled ?? true,
        paypalEnabled: document.paymentSettings?.paypalEnabled ?? false,
        applePay: document.paymentSettings?.applePay ?? true,
        googlePay: document.paymentSettings?.googlePay ?? true,
        minimumOrderAmount: document.paymentSettings?.minimumOrderAmount || 5,
        processingFeePercentage: document.paymentSettings?.processingFeePercentage || 2.9,
        refundProcessingDays: document.paymentSettings?.refundProcessingDays || 7,
        autoRefundEnabled: document.paymentSettings?.autoRefundEnabled ?? false,
      },
      description: document.description,
      createdBy: document.createdBy?.toString() || document.adminId?.toString() || '',
      createdAt: document.createdAt || new Date(),
      updatedAt: document.updatedAt || new Date(),
    };
  }

  static toInterfaceArray(documents: any[]): ISystemConfig[] {
    return documents.map(doc => this.toInterface(doc));
  }

  static toValidationResult(result: any): IConfigValidationResult {
    return {
      isValid: result.isValid || false,
      errors: result.errors || [],
      warnings: result.warnings || [],
    };
  }
}