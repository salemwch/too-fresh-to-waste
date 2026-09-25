import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  AdminSystemConfigChangedEvent,
  AdminSystemConfigRolledBackEvent,
  AdminMaintenanceModeChangedEvent,
  AdminSecurityConfigChangedEvent,
  AdminPaymentConfigChangedEvent,
} from '../../common/events/admin-system.events';
import { ISystemConfig } from '../../common/interfaces/system-config.interface';
import { SystemConfigMapper } from '../../common/mappers/system-config.mapper';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { UpdateSystemConfigDto } from '../dto/system-config.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';
import { SystemConfig, SystemConfigDocument } from '../schemas/system-config.schema';

import { AdminAuditService, AuditableObject } from './admin-audit.service';

import { appError } from '../../common/errors';
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Interfaces for type safety
export interface ConfigExportData {
  version: string;
  exportedAt: string;
  platformSettings: {
    maintenanceMode?: boolean;
    allowNewRegistrations?: boolean;
    requireEstablishmentApproval?: boolean;
    maxOffersPerEstablishment?: number;
    defaultOfferExpirationHours?: number;
    minOrderValue?: number;
    maxOrderValue?: number;
    platformCommissionRate?: number;
    autoRefundTimeoutHours?: number;
  };
  notificationSettings: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    pushNotificationsEnabled?: boolean;
    adminEmailAlerts?: boolean;
    orderConfirmationEnabled?: boolean;
    orderReminderEnabled?: boolean;
    promotionalEmailsEnabled?: boolean;
  };
  securitySettings: {
    maxLoginAttempts?: number;
    loginAttemptWindow?: number;
    accountLockoutDuration?: number;
    passwordMinLength?: number;
    passwordRequireSpecialChar?: boolean;
    passwordRequireNumbers?: boolean;
    passwordRequireUppercase?: boolean;
    sessionTimeout?: number;
    twoFactorAuthRequired?: boolean;
  };
  paymentSettings: {
    stripeEnabled?: boolean;
    paypalEnabled?: boolean;
    minimumPayoutAmount?: number;
    payoutFrequency?: 'daily' | 'weekly' | 'monthly';
    automaticPayouts?: boolean;
    refundProcessingDays?: number;
  };
  description?: string | undefined;
}

export interface ConfigImportData {
  version?: string;
  platformSettings?: {
    maintenanceMode?: boolean;
    allowNewRegistrations?: boolean;
    requireEstablishmentApproval?: boolean;
    maxOffersPerEstablishment?: number;
    defaultOfferExpirationHours?: number;
    minOrderValue?: number;
    maxOrderValue?: number;
    platformCommissionRate?: number;
    autoRefundTimeoutHours?: number;
  };
  notificationSettings?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    pushNotificationsEnabled?: boolean;
    adminEmailAlerts?: boolean;
    orderConfirmationEnabled?: boolean;
    orderReminderEnabled?: boolean;
    promotionalEmailsEnabled?: boolean;
  };
  securitySettings?: {
    maxLoginAttempts?: number;
    loginAttemptWindow?: number;
    accountLockoutDuration?: number;
    passwordMinLength?: number;
    passwordRequireSpecialChar?: boolean;
    passwordRequireNumbers?: boolean;
    passwordRequireUppercase?: boolean;
    sessionTimeout?: number;
    twoFactorAuthRequired?: boolean;
  };
  paymentSettings?: {
    stripeEnabled?: boolean;
    paypalEnabled?: boolean;
    minimumPayoutAmount?: number;
    payoutFrequency?: 'daily' | 'weekly' | 'monthly';
    automaticPayouts?: boolean;
    refundProcessingDays?: number;
  };
  description?: string;
}

// Partial interfaces for validation parameters
export interface PlatformSettingsPartial {
  maintenanceMode?: boolean;
  allowNewRegistrations?: boolean;
  requireEstablishmentApproval?: boolean;
  maxOffersPerEstablishment?: number;
  defaultOfferExpirationHours?: number;
  minOrderValue?: number;
  maxOrderValue?: number;
  platformCommissionRate?: number;
  autoRefundTimeoutHours?: number;
}

export interface SecuritySettingsPartial {
  maxLoginAttempts?: number;
  loginAttemptWindow?: number;
  accountLockoutDuration?: number;
  passwordMinLength?: number;
  passwordRequireSpecialChar?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireUppercase?: boolean;
  sessionTimeout?: number;
  twoFactorAuthRequired?: boolean;
}

export interface PaymentSettingsPartial {
  stripeEnabled?: boolean;
  paypalEnabled?: boolean;
  minimumPayoutAmount?: number;
  payoutFrequency?: 'daily' | 'weekly' | 'monthly';
  automaticPayouts?: boolean;
  refundProcessingDays?: number;
}

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private readonly CONFIG_KEY = 'platform_config';
  private configCache: ISystemConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectModel(SystemConfig.name) private readonly configModel: Model<SystemConfigDocument>,
    private readonly auditService: AdminAuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async getSystemConfig(): Promise<ISystemConfig> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.configCache && now - this.cacheTimestamp < this.CACHE_TTL) {
        return this.configCache;
      }

      const config = await this.configModel
        .findOne({ configKey: this.CONFIG_KEY, isActive: true })
        .exec();

      let mappedConfig: ISystemConfig;

      if (!config) {
        // Create default configuration if none exists
        mappedConfig = await this.createDefaultConfig();
      } else {
        mappedConfig = SystemConfigMapper.toInterface(config);
      }
      this.configCache = null; // Clear cache to avoid type conflicts
      this.cacheTimestamp = 0;

      return mappedConfig;
    } catch (error) {
      this.logger.error('Failed to get system configuration:', error);
      throw error;
    }
  }

  async updateSystemConfig(
    updateDto: UpdateSystemConfigDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ISystemConfig> {
    try {
      // Get the raw document for internal processing
      const currentConfigDoc = await this.configModel
        .findOne({ configKey: this.CONFIG_KEY, isActive: true })
        .exec();

      if (!currentConfigDoc) {
        throw new NotFoundException(appError('CONFIG_NOT_FOUND'));
      }

      // Convert to interface for validation
      const currentConfig = SystemConfigMapper.toInterface(currentConfigDoc);

      // Validate the new configuration
      const validationResult = this.validateConfig(updateDto, currentConfig);

      if (!validationResult.isValid) {
        throw new BadRequestException(
          appError('CONFIG_INVALID', { details: String(validationResult.errors.join(', ')) }),
        );
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        this.logger.warn(`Configuration warnings: ${validationResult.warnings.join(', ')}`);
      }

      const previousValue = {
        platformSettings: currentConfig.platformSettings,
        notificationSettings: currentConfig.notificationSettings,
        securitySettings: currentConfig.securitySettings,
        paymentSettings: currentConfig.paymentSettings,
      } as unknown as AuditableObject;

      // Create new version of configuration
      const newVersion = this.generateNewVersion(currentConfig.version);

      // Deactivate current configuration
      await this.configModel.updateOne({ _id: currentConfigDoc._id }, { isActive: false });

      // Create new configuration with updates
      const updatedConfig = new this.configModel({
        configKey: this.CONFIG_KEY,
        version: newVersion,
        platformSettings: {
          ...currentConfig.platformSettings,
          ...updateDto.platformSettings,
        },
        notificationSettings: {
          ...currentConfig.notificationSettings,
          ...updateDto.notificationSettings,
        },
        securitySettings: {
          ...currentConfig.securitySettings,
          ...updateDto.securitySettings,
        },
        paymentSettings: {
          ...currentConfig.paymentSettings,
          ...updateDto.paymentSettings,
        },
        description: updateDto.description,
        lastModifiedBy: adminEmail,
        isActive: true,
      });

      const savedConfig = await updatedConfig.save();

      // Clear cache
      this.configCache = null;

      // Log the action
      await this.auditService.logSystemAction({
        adminId,
        adminEmail,
        action: AdminAction.SYSTEM_CONFIG_UPDATED,
        previousValue,
        newValue: {
          version: newVersion,
          platformSettings: savedConfig.platformSettings as unknown as AuditableObject,
          notificationSettings: savedConfig.notificationSettings as unknown as AuditableObject,
          securitySettings: savedConfig.securitySettings as unknown as AuditableObject,
          paymentSettings: savedConfig.paymentSettings as unknown as AuditableObject,
        } as AuditableObject,
        reason: updateDto.description ?? 'System configuration updated',
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `System configuration updated to version ${newVersion} by admin ${adminEmail}`,
      );

      // Emit domain events for cache invalidation and service refresh
      await this.emitConfigChangedEvents(
        adminId,
        adminEmail,
        currentConfig,
        savedConfig,
        updateDto,
      );

      return SystemConfigMapper.toInterface(savedConfig);
    } catch (error) {
      this.logger.error('Failed to update system configuration:', error);
      throw error;
    }
  }

  async getConfigHistory(limit: number = 20): Promise<ISystemConfig[]> {
    try {
      const configs = await this.configModel
        .find({ configKey: this.CONFIG_KEY })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();

      return SystemConfigMapper.toInterfaceArray(configs);
    } catch (error) {
      this.logger.error('Failed to get configuration history:', error);
      throw error;
    }
  }

  async rollbackToVersion(
    version: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ISystemConfig> {
    try {
      const targetConfig = await this.configModel
        .findOne({ configKey: this.CONFIG_KEY, version })
        .exec();

      if (!targetConfig) {
        throw new NotFoundException(appError('CONFIG_VERSION_NOT_FOUND', { version }));
      }

      // Get current config document for deactivation
      const currentConfigDoc = await this.configModel
        .findOne({ configKey: this.CONFIG_KEY, isActive: true })
        .exec();

      if (!currentConfigDoc) {
        throw new NotFoundException(appError('CONFIG_NOT_FOUND'));
      }

      // Deactivate current configuration
      await this.configModel.updateOne({ _id: currentConfigDoc._id }, { isActive: false });

      // Create new configuration based on target version
      const rollbackConfig = new this.configModel({
        configKey: this.CONFIG_KEY,
        version: this.generateNewVersion(currentConfigDoc.version, 'rollback'),
        platformSettings: targetConfig.platformSettings,
        notificationSettings: targetConfig.notificationSettings,
        securitySettings: targetConfig.securitySettings,
        paymentSettings: targetConfig.paymentSettings,
        description: `Rollback to version ${version}`,
        lastModifiedBy: adminEmail,
        isActive: true,
      });

      const savedConfig = await rollbackConfig.save();

      // Clear cache
      this.configCache = null;

      // Log the action
      await this.auditService.logSystemAction({
        adminId,
        adminEmail,
        action: AdminAction.SYSTEM_CONFIG_UPDATED,
        previousValue: {
          currentVersion: currentConfigDoc.version,
          action: 'rollback',
        },
        newValue: {
          newVersion: savedConfig.version,
          rolledBackToVersion: version,
          platformSettings: savedConfig.platformSettings as unknown as AuditableObject,
          notificationSettings: savedConfig.notificationSettings as unknown as AuditableObject,
          securitySettings: savedConfig.securitySettings as unknown as AuditableObject,
          paymentSettings: savedConfig.paymentSettings as unknown as AuditableObject,
        } as AuditableObject,
        reason: `Rolled back configuration to version ${version}`,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `System configuration rolled back to version ${version} by admin ${adminEmail}`,
      );

      // Emit rollback event for emergency cache clearing
      await this.eventBus.emit(
        'admin.system.config_rolled_back',
        new AdminSystemConfigRolledBackEvent(
          adminId,
          adminEmail,
          currentConfigDoc.version,
          version,
          `Rolled back configuration to version ${version}`,
        ),
      );

      return SystemConfigMapper.toInterface(savedConfig);
    } catch (error) {
      this.logger.error(`Failed to rollback to configuration version ${version}:`, error);
      throw error;
    }
  }

  async exportConfig(version?: string): Promise<ConfigExportData> {
    try {
      let config: SystemConfigDocument;

      if (version) {
        const versionConfig = await this.configModel
          .findOne({ configKey: this.CONFIG_KEY, version })
          .exec();

        if (!versionConfig) {
          throw new NotFoundException(appError('CONFIG_VERSION_NOT_FOUND', { version }));
        }
        config = versionConfig;
      } else {
        const currentConfig = await this.configModel
          .findOne({ configKey: this.CONFIG_KEY, isActive: true })
          .exec();

        if (!currentConfig) {
          throw new NotFoundException(appError('CONFIG_NOT_FOUND'));
        }
        config = currentConfig;
      }

      // Remove internal fields for export
      const exportData = {
        version: config.version,
        exportedAt: new Date().toISOString(),
        platformSettings: config.platformSettings,
        notificationSettings: config.notificationSettings,
        securitySettings: config.securitySettings,
        paymentSettings: config.paymentSettings,
        description: config.description,
      };

      return exportData;
    } catch (error) {
      this.logger.error('Failed to export configuration:', error);
      throw error;
    }
  }

  validateConfigImport(importData: unknown): ConfigValidationResult {
    try {
      const result: ConfigValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      // Type guard to ensure importData is an object
      if (typeof importData !== 'object' || importData === null) {
        result.errors.push('Import data must be a valid object');
        result.isValid = false;
        return result;
      }

      const data = importData as Record<string, unknown>;
      const platformSettings = data['platformSettings'];
      const notificationSettings = data['notificationSettings'];
      const securitySettings = data['securitySettings'];
      const paymentSettings = data['paymentSettings'];

      // Validate required fields
      if (
        platformSettings === null ||
        platformSettings === undefined ||
        typeof platformSettings !== 'object'
      ) {
        result.errors.push('Platform settings are required and must be an object');
      }

      if (
        notificationSettings === null ||
        notificationSettings === undefined ||
        typeof notificationSettings !== 'object'
      ) {
        result.errors.push('Notification settings are required and must be an object');
      }

      if (
        securitySettings === null ||
        securitySettings === undefined ||
        typeof securitySettings !== 'object'
      ) {
        result.errors.push('Security settings are required and must be an object');
      }

      if (
        paymentSettings === null ||
        paymentSettings === undefined ||
        typeof paymentSettings !== 'object'
      ) {
        result.errors.push('Payment settings are required and must be an object');
      }

      // Validate specific settings if they exist and are objects
      if (
        platformSettings !== null &&
        platformSettings !== undefined &&
        typeof platformSettings === 'object'
      ) {
        const platformValidation = this.validatePlatformSettings(
          platformSettings as PlatformSettingsPartial,
        );
        result.errors.push(...platformValidation.errors);
        result.warnings.push(...platformValidation.warnings);
      }

      if (
        securitySettings !== null &&
        securitySettings !== undefined &&
        typeof securitySettings === 'object'
      ) {
        const securityValidation = this.validateSecuritySettings(
          securitySettings as SecuritySettingsPartial,
        );
        result.errors.push(...securityValidation.errors);
        result.warnings.push(...securityValidation.warnings);
      }

      if (
        paymentSettings !== null &&
        paymentSettings !== undefined &&
        typeof paymentSettings === 'object'
      ) {
        const paymentValidation = this.validatePaymentSettings(
          paymentSettings as PaymentSettingsPartial,
        );
        result.errors.push(...paymentValidation.errors);
        result.warnings.push(...paymentValidation.warnings);
      }

      result.isValid = result.errors.length === 0;

      return result;
    } catch (error) {
      this.logger.error('Failed to validate configuration import:', error);
      return {
        isValid: false,
        errors: ['Failed to validate configuration'],
        warnings: [],
      };
    }
  }

  async importConfig(
    importData: unknown,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ISystemConfig> {
    try {
      // Validate import data
      const validationResult = this.validateConfigImport(importData);

      if (!validationResult.isValid) {
        throw new BadRequestException(
          appError('CONFIG_IMPORT_INVALID', {
            details: String(validationResult.errors.join(', ')),
          }),
        );
      }

      // Type guard after validation
      if (typeof importData !== 'object' || importData === null) {
        throw new BadRequestException(appError('CONFIG_IMPORT_NOT_OBJECT'));
      }

      const data = importData as ConfigImportData;

      const updateDto: UpdateSystemConfigDto = {
        ...(data.platformSettings !== undefined ? { platformSettings: data.platformSettings } : {}),
        ...(data.notificationSettings !== undefined
          ? { notificationSettings: data.notificationSettings }
          : {}),
        ...(data.securitySettings !== undefined ? { securitySettings: data.securitySettings } : {}),
        ...(data.paymentSettings !== undefined ? { paymentSettings: data.paymentSettings } : {}),
        description: `Imported configuration from version ${data.version ?? 'unknown'}`,
      };

      return await this.updateSystemConfig(updateDto, adminId, adminEmail, ipAddress, userAgent);
    } catch (error) {
      this.logger.error('Failed to import configuration:', error);
      throw error;
    }
  }

  // Helper Methods

  private async createDefaultConfig(): Promise<ISystemConfig> {
    const defaultConfig = new this.configModel({
      configKey: this.CONFIG_KEY,
      version: '1.0.0',
      platformSettings: {
        maintenanceMode: false,
        allowNewRegistrations: true,
        requireEstablishmentApproval: true,
        maxOffersPerEstablishment: 50,
        defaultOfferExpirationHours: 24,
        minOrderValue: 1,
        maxOrderValue: 1000,
        platformCommissionRate: 15,
        autoRefundTimeoutHours: 24,
      },
      notificationSettings: {
        emailEnabled: true,
        smsEnabled: false,
        pushNotificationsEnabled: true,
        adminEmailAlerts: true,
        orderConfirmationEnabled: true,
        orderReminderEnabled: true,
        promotionalEmailsEnabled: true,
      },
      securitySettings: {
        maxLoginAttempts: 10,
        loginAttemptWindow: 15,
        accountLockoutDuration: 30,
        passwordMinLength: 8,
        passwordRequireSpecialChar: true,
        passwordRequireNumbers: true,
        passwordRequireUppercase: true,
        sessionTimeout: 480,
        twoFactorAuthRequired: false,
      },
      paymentSettings: {
        stripeEnabled: true,
        paypalEnabled: false,
        minimumPayoutAmount: 10,
        payoutFrequency: 'weekly',
        automaticPayouts: true,
        refundProcessingDays: 3,
      },
      description: 'Default system configuration',
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedConfig = await defaultConfig.save();
    this.logger.log('Created default system configuration');

    return SystemConfigMapper.toInterface(savedConfig);
  }

  private validateConfig(
    updateDto: UpdateSystemConfigDto,
    _currentConfig: ISystemConfig,
  ): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Validate platform settings
    if (updateDto.platformSettings) {
      const platformValidation = this.validatePlatformSettings(updateDto.platformSettings);
      result.errors.push(...platformValidation.errors);
      result.warnings.push(...platformValidation.warnings);
    }

    // Validate security settings
    if (updateDto.securitySettings) {
      const securityValidation = this.validateSecuritySettings(updateDto.securitySettings);
      result.errors.push(...securityValidation.errors);
      result.warnings.push(...securityValidation.warnings);
    }

    // Validate payment settings
    if (updateDto.paymentSettings) {
      const paymentValidation = this.validatePaymentSettings(updateDto.paymentSettings);
      result.errors.push(...paymentValidation.errors);
      result.warnings.push(...paymentValidation.warnings);
    }

    result.isValid = result.errors.length === 0;

    return result;
  }

  private validatePlatformSettings(settings: PlatformSettingsPartial): ConfigValidationResult {
    const result: ConfigValidationResult = { isValid: true, errors: [], warnings: [] };

    if (settings.platformCommissionRate !== undefined) {
      if (settings.platformCommissionRate < 0 || settings.platformCommissionRate > 50) {
        result.errors.push('Platform commission rate must be between 0% and 50%');
      } else if (settings.platformCommissionRate > 25) {
        result.warnings.push('Platform commission rate is quite high (>25%)');
      }
    }

    if (settings.minOrderValue !== undefined && settings.maxOrderValue !== undefined) {
      if (settings.minOrderValue >= settings.maxOrderValue) {
        result.errors.push('Minimum order value must be less than maximum order value');
      }
    }

    if (settings.defaultOfferExpirationHours !== undefined) {
      if (settings.defaultOfferExpirationHours < 1 || settings.defaultOfferExpirationHours > 168) {
        result.errors.push('Default offer expiration must be between 1 and 168 hours (1 week)');
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private validateSecuritySettings(settings: SecuritySettingsPartial): ConfigValidationResult {
    const result: ConfigValidationResult = { isValid: true, errors: [], warnings: [] };

    if (settings.maxLoginAttempts !== undefined) {
      if (settings.maxLoginAttempts < 3 || settings.maxLoginAttempts > 10) {
        result.errors.push('Max login attempts must be between 3 and 10');
      }
    }

    if (settings.passwordMinLength !== undefined) {
      if (settings.passwordMinLength < 6 || settings.passwordMinLength > 128) {
        result.errors.push('Password minimum length must be between 6 and 128 characters');
      } else if (settings.passwordMinLength < 8) {
        result.warnings.push('Password minimum length less than 8 is not recommended');
      }
    }

    if (settings.sessionTimeout !== undefined) {
      if (settings.sessionTimeout < 30 || settings.sessionTimeout > 1440) {
        result.errors.push('Session timeout must be between 30 and 1440 minutes (24 hours)');
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private validatePaymentSettings(settings: PaymentSettingsPartial): ConfigValidationResult {
    const result: ConfigValidationResult = { isValid: true, errors: [], warnings: [] };

    if (settings.stripeEnabled !== true && settings.paypalEnabled !== true) {
      result.errors.push('At least one payment provider must be enabled');
    }

    if (settings.minimumPayoutAmount !== undefined) {
      if (settings.minimumPayoutAmount < 1) {
        result.errors.push('Minimum payout amount must be at least 1');
      }
    }

    if (settings.refundProcessingDays !== undefined) {
      if (settings.refundProcessingDays < 1 || settings.refundProcessingDays > 30) {
        result.errors.push('Refund processing days must be between 1 and 30');
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private generateNewVersion(currentVersion: string, suffix?: string): string {
    const versionParts = currentVersion.split('.');
    const major = parseInt(versionParts[0] ?? '1', 10) || 1;
    const minor = parseInt(versionParts[1] ?? '0', 10) || 0;
    const patch = parseInt(versionParts[2] ?? '0', 10) || 0;

    const newPatch = patch + 1;
    const newVersion = `${major}.${minor}.${newPatch}`;

    return suffix ? `${newVersion}-${suffix}` : newVersion;
  }

  /**
   * Emit configuration change events for targeted service reactions
   * Different services can subscribe to specific config changes
   */
  private async emitConfigChangedEvents(
    adminId: string,
    adminEmail: string,
    previousConfig: ISystemConfig,
    newConfig: SystemConfigDocument,
    updateDto: UpdateSystemConfigDto,
  ): Promise<void> {
    try {
      const changedFields: string[] = [];
      const previousValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      // Detect changed fields
      if (updateDto.platformSettings) {
        Object.keys(updateDto.platformSettings).forEach(key => {
          changedFields.push(`platformSettings.${key}`);
          previousValues[`platformSettings.${key}`] = (
            previousConfig.platformSettings as unknown as Record<string, unknown> | undefined
          )?.[key];
          newValues[`platformSettings.${key}`] = (
            updateDto.platformSettings as Record<string, unknown>
          )[key];
        });

        // Check for maintenance mode change (critical)
        if (
          updateDto.platformSettings.maintenanceMode !== undefined &&
          updateDto.platformSettings.maintenanceMode !==
            previousConfig.platformSettings?.maintenanceMode
        ) {
          await this.eventBus.emit(
            'admin.system.maintenance_mode_changed',
            new AdminMaintenanceModeChangedEvent(
              adminId,
              adminEmail,
              updateDto.platformSettings.maintenanceMode,
              updateDto.description,
            ),
          );
        }
      }

      if (updateDto.securitySettings) {
        const securityChangedFields: string[] = [];
        Object.keys(updateDto.securitySettings).forEach(key => {
          securityChangedFields.push(key);
          changedFields.push(`securitySettings.${key}`);
          previousValues[`securitySettings.${key}`] = (
            previousConfig.securitySettings as unknown as Record<string, unknown> | undefined
          )?.[key];
          newValues[`securitySettings.${key}`] = (
            updateDto.securitySettings as Record<string, unknown>
          )[key];
        });

        // Emit specific security config changed event
        if (securityChangedFields.length > 0) {
          await this.eventBus.emit(
            'admin.system.security_config_changed',
            new AdminSecurityConfigChangedEvent(
              adminId,
              adminEmail,
              securityChangedFields,
              (previousConfig.securitySettings as unknown as Record<string, unknown>) ?? {},
              updateDto.securitySettings as unknown as Record<string, unknown>,
            ),
          );
        }
      }

      if (updateDto.paymentSettings) {
        const paymentChangedFields: string[] = [];
        Object.keys(updateDto.paymentSettings).forEach(key => {
          paymentChangedFields.push(key);
          changedFields.push(`paymentSettings.${key}`);
          previousValues[`paymentSettings.${key}`] = (
            previousConfig.paymentSettings as unknown as Record<string, unknown> | undefined
          )?.[key];
          newValues[`paymentSettings.${key}`] = (
            updateDto.paymentSettings as Record<string, unknown>
          )[key];
        });

        // Emit specific payment config changed event
        if (paymentChangedFields.length > 0) {
          await this.eventBus.emit(
            'admin.system.payment_config_changed',
            new AdminPaymentConfigChangedEvent(
              adminId,
              adminEmail,
              paymentChangedFields,
              (previousConfig.paymentSettings as unknown as Record<string, unknown>) ?? {},
              updateDto.paymentSettings as unknown as Record<string, unknown>,
            ),
          );
        }
      }

      if (updateDto.notificationSettings) {
        Object.keys(updateDto.notificationSettings).forEach(key => {
          changedFields.push(`notificationSettings.${key}`);
          previousValues[`notificationSettings.${key}`] = (
            previousConfig.notificationSettings as unknown as Record<string, unknown> | undefined
          )?.[key];
          newValues[`notificationSettings.${key}`] = (
            updateDto.notificationSettings as Record<string, unknown>
          )[key];
        });
      }

      // Emit generic config changed event
      if (changedFields.length > 0) {
        await this.eventBus.emit(
          'admin.system.config_changed',
          new AdminSystemConfigChangedEvent(
            adminId,
            adminEmail,
            previousConfig.version,
            newConfig.version,
            changedFields,
            previousValues,
            newValues,
            updateDto.description,
          ),
        );
      }

      this.logger.debug(
        `Emitted config change events: ${changedFields.length} fields changed in version ${newConfig.version}`,
      );
    } catch (error) {
      this.logger.error('Failed to emit config change events:', error);
    }
  }
}
