import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { USER_AUDIT_LOG_MAX } from '../../common/constants/database-indexes.constant';
import { User, UserDocument } from '../schemas/user.schema';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  currency: string;
  notifications: {
    email: {
      marketing: boolean;
      orderUpdates: boolean;
      newOffers: boolean;
      weeklyDigest: boolean;
      securityAlerts: boolean;
    };
    push: {
      orderUpdates: boolean;
      nearbyOffers: boolean;
      favoriteStoreOffers: boolean;
      newMessages: boolean;
    };
    sms: {
      orderConfirmation: boolean;
      securityAlerts: boolean;
    };
  };
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showOnlineStatus: boolean;
    allowDataAnalytics: boolean;
    allowPersonalization: boolean;
  };
  discovery: {
    maxDistance: number;
    preferredCategories: string[];
    excludedCategories: string[];
    minDiscount: number;
    showExpiringSoon: boolean;
    autoSaveSearches: boolean;
  };
}

export interface NotificationPreferences {
  email: {
    marketing: boolean;
    orderUpdates: boolean;
    newOffers: boolean;
    weeklyDigest: boolean;
    securityAlerts: boolean;
  };
  push: {
    orderUpdates: boolean;
    nearbyOffers: boolean;
    favoriteStoreOffers: boolean;
    newMessages: boolean;
  };
  sms: {
    orderConfirmation: boolean;
    securityAlerts: boolean;
  };
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  allowDataAnalytics: boolean;
  allowPersonalization: boolean;
}

export interface DiscoveryPreferences {
  maxDistance: number;
  preferredCategories: string[];
  excludedCategories: string[];
  minDiscount: number;
  showExpiringSoon: boolean;
  autoSaveSearches: boolean;
}

interface AuditLogDetails {
  updatedFields?: string[];
  changes?: Partial<
    UserPreferences | NotificationPreferences | PrivacyPreferences | DiscoveryPreferences
  >;
  complianceNote?: string;
  resetTo?: string;
  source?: string;
  [key: string]: unknown;
}

interface PreferencesHistoryEntry {
  action: string;
  timestamp: Date;
  changes: AuditLogDetails;
  ipAddress: string;
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
      ? RecursivePartial<T[P]>
      : T[P];
};

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  private readonly defaultPreferences: UserPreferences = {
    theme: 'auto',
    language: 'en',
    timezone: 'UTC',
    currency: 'USD',
    notifications: {
      email: {
        marketing: false,
        orderUpdates: true,
        newOffers: true,
        weeklyDigest: false,
        securityAlerts: true,
      },
      push: {
        orderUpdates: true,
        nearbyOffers: true,
        favoriteStoreOffers: true,
        newMessages: true,
      },
      sms: {
        orderConfirmation: false,
        securityAlerts: true,
      },
    },
    privacy: {
      profileVisibility: 'private',
      showOnlineStatus: false,
      allowDataAnalytics: false,
      allowPersonalization: true,
    },
    discovery: {
      maxDistance: 5000, // 5km default
      preferredCategories: [],
      excludedCategories: [],
      minDiscount: 0,
      showExpiringSoon: true,
      autoSaveSearches: false,
    },
  };

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return user preferences or defaults if not set
    return user.preferences ?? this.defaultPreferences;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<UserPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Initialize preferences if not exists
    user.preferences ??= { ...this.defaultPreferences };

    // Deep merge preferences
    user.preferences = this.deepMerge(user.preferences, preferences);

    // Validate preferences
    this.validatePreferences(user.preferences);

    // Add audit log entry
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'PREFERENCES_UPDATED',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: {
          updatedFields: Object.keys(preferences),
          changes: preferences,
        },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Preferences updated for user: ${user.email}`);

    return user.preferences;
  }

  async updateNotificationPreferences(
    userId: string,
    notificationPrefs: Partial<NotificationPreferences>,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<NotificationPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.preferences ??= { ...this.defaultPreferences };

    // Update only notification preferences
    user.preferences.notifications = this.deepMerge(
      user.preferences.notifications,
      notificationPrefs,
    );

    // Add audit log entry
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: { changes: notificationPrefs },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Notification preferences updated for user: ${user.email}`);

    return user.preferences.notifications;
  }

  async updatePrivacyPreferences(
    userId: string,
    privacyPrefs: Partial<PrivacyPreferences>,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<PrivacyPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.preferences ??= { ...this.defaultPreferences };

    // Update only privacy preferences
    user.preferences.privacy = this.deepMerge(user.preferences.privacy, privacyPrefs);

    // Add audit log entry for privacy changes (important for compliance)
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'PRIVACY_PREFERENCES_UPDATED',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: {
          changes: privacyPrefs,
          complianceNote: 'Privacy setting changes logged for GDPR/CCPA compliance',
        },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Privacy preferences updated for user: ${user.email}`);

    return user.preferences.privacy;
  }

  async updateDiscoveryPreferences(
    userId: string,
    discoveryPrefs: Partial<DiscoveryPreferences>,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<DiscoveryPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.preferences ??= { ...this.defaultPreferences };

    // Validate discovery preferences
    if (
      discoveryPrefs.maxDistance &&
      (discoveryPrefs.maxDistance < 100 || discoveryPrefs.maxDistance > 50000)
    ) {
      throw new BadRequestException('Max distance must be between 100m and 50km');
    }

    if (
      discoveryPrefs.minDiscount &&
      (discoveryPrefs.minDiscount < 0 || discoveryPrefs.minDiscount > 100)
    ) {
      throw new BadRequestException('Minimum discount must be between 0% and 100%');
    }

    // Update only discovery preferences
    user.preferences.discovery = this.deepMerge(user.preferences.discovery, discoveryPrefs);

    // Add audit log entry
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'DISCOVERY_PREFERENCES_UPDATED',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: { changes: discoveryPrefs },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Discovery preferences updated for user: ${user.email}`);

    return user.preferences.discovery;
  }

  async resetPreferences(
    userId: string,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<UserPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Reset to default preferences
    user.preferences = { ...this.defaultPreferences };

    // Add audit log entry
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'PREFERENCES_RESET',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: { resetTo: 'defaults' },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Preferences reset to defaults for user: ${user.email}`);

    return user.preferences;
  }

  async exportUserPreferences(userId: string): Promise<{
    userId: string;
    preferences: UserPreferences;
    exportedAt: Date;
    version: string;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferences = user.preferences ?? this.defaultPreferences;

    return {
      userId,
      preferences,
      exportedAt: new Date(),
      version: '1.0',
    };
  }

  async importUserPreferences(
    userId: string,
    preferencesData: UserPreferences,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<UserPreferences> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate imported preferences
    this.validatePreferences(preferencesData);

    // Import preferences
    user.preferences = preferencesData;

    // Add audit log entry
    if (auditData) {
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'PREFERENCES_IMPORTED',
        timestamp: new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        details: { source: 'user_import' },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }
    }

    await user.save();

    this.logger.log(`Preferences imported for user: ${user.email}`);

    return user.preferences;
  }

  async getPreferencesHistory(userId: string, limit = 10): Promise<PreferencesHistoryEntry[]> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferencesActions = [
      'PREFERENCES_UPDATED',
      'NOTIFICATION_PREFERENCES_UPDATED',
      'PRIVACY_PREFERENCES_UPDATED',
      'DISCOVERY_PREFERENCES_UPDATED',
      'PREFERENCES_RESET',
      'PREFERENCES_IMPORTED',
    ];

    return (user.auditLog ?? [])
      .filter(entry => preferencesActions.includes(entry.action))
      .slice(0, limit)
      .map(entry => ({
        action: entry.action,
        timestamp: entry.timestamp,
        changes: entry.details as AuditLogDetails,
        ipAddress: entry.ipAddress,
      }));
  }

  private validatePreferences(preferences: UserPreferences): void {
    // Validate theme
    if (!['light', 'dark', 'auto'].includes(preferences.theme)) {
      throw new BadRequestException('Invalid theme value');
    }

    // Validate profile visibility
    if (!['public', 'friends', 'private'].includes(preferences.privacy.profileVisibility)) {
      throw new BadRequestException('Invalid profile visibility value');
    }

    // Validate max distance
    if (preferences.discovery.maxDistance < 100 || preferences.discovery.maxDistance > 50000) {
      throw new BadRequestException('Max distance must be between 100m and 50km');
    }

    // Validate min discount
    if (preferences.discovery.minDiscount < 0 || preferences.discovery.minDiscount > 100) {
      throw new BadRequestException('Minimum discount must be between 0% and 100%');
    }

    // Validate language code (basic check)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(preferences.language)) {
      throw new BadRequestException('Invalid language code format');
    }

    // Validate currency code (basic check)
    if (!/^[A-Z]{3}$/.test(preferences.currency)) {
      throw new BadRequestException('Invalid currency code format');
    }
  }

  private deepMerge<T>(target: T, source: RecursivePartial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];

      if (sourceValue !== undefined && sourceValue !== null) {
        const targetValue = target[key];

        if (
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          !(sourceValue instanceof Date) &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue) &&
          !(targetValue instanceof Date)
        ) {
          (result as Record<string, unknown>)[key] = this.deepMerge(
            targetValue,
            sourceValue as RecursivePartial<typeof targetValue>,
          );
        } else {
          (result as Record<string, unknown>)[key] = sourceValue;
        }
      }
    }

    return result;
  }

  getDefaultPreferences(): UserPreferences {
    return { ...this.defaultPreferences };
  }

  async getNotificationOptouts(userId: string): Promise<{
    emailMarketing: boolean;
    smsMarketing: boolean;
    pushMarketing: boolean;
    analytics: boolean;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferences = user.preferences ?? this.defaultPreferences;

    return {
      emailMarketing: !preferences.notifications.email.marketing,
      smsMarketing: false, // SMS marketing not implemented yet
      pushMarketing: false, // Push marketing not implemented yet
      analytics: !preferences.privacy.allowDataAnalytics,
    };
  }

  async bulkUpdateNotificationPreferences(
    userIds: string[],
    notificationPrefs: Partial<NotificationPreferences>,
    reason: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        await this.updateNotificationPreferences(userId, notificationPrefs, {
          ipAddress: 'system',
          userAgent: `bulk_update:${reason}`,
        });
        success++;
      } catch (error) {
        failed++;
        errors.push(`User ${userId}: ${(error as Error).message}`);
      }
    }

    this.logger.log(
      `Bulk notification preferences update completed. Success: ${success}, Failed: ${failed}`,
    );

    return { success, failed, errors };
  }
}
