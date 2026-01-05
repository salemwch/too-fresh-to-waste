export interface ISystemConfig {
  readonly id: string;
  readonly version: string;
  readonly isActive: boolean;
  readonly platformSettings: IPlatformSettings;
  readonly notificationSettings: INotificationSettings;
  readonly securitySettings: ISecuritySettings;
  readonly paymentSettings: IPaymentSettings;
  readonly description?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IPlatformSettings {
  readonly maintenanceMode: boolean;
  readonly allowNewRegistrations: boolean;
  readonly maxOrdersPerDay: number;
  readonly defaultCurrency: string;
  readonly supportedLanguages: string[];
  readonly businessHours: {
    readonly start: string;
    readonly end: string;
    readonly timezone: string;
  };
}

export interface INotificationSettings {
  readonly emailNotifications: boolean;
  readonly pushNotifications: boolean;
  readonly smsNotifications: boolean;
  readonly emailTemplates: Record<string, string>;
  readonly notificationRetryAttempts: number;
  readonly quietHours: {
    readonly start: string;
    readonly end: string;
  };
}

export interface ISecuritySettings {
  readonly passwordMinLength: number;
  readonly passwordRequireNumbers: boolean;
  readonly passwordRequireSymbols: boolean;
  readonly sessionTimeoutMinutes: number;
  readonly maxLoginAttempts: number;
  readonly lockoutDurationMinutes: number;
  readonly requireTwoFactor: boolean;
  readonly allowedFileTypes: string[];
  readonly maxFileSize: number;
}

export interface IPaymentSettings {
  readonly stripeEnabled: boolean;
  readonly paypalEnabled: boolean;
  readonly applePay: boolean;
  readonly googlePay: boolean;
  readonly minimumOrderAmount: number;
  readonly processingFeePercentage: number;
  readonly refundProcessingDays: number;
  readonly autoRefundEnabled: boolean;
}

export interface IConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}