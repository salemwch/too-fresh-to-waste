import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { Model, Types, FilterQuery } from 'mongoose';

import { UpdateNotificationPreferencesDto } from '../dto/notification-preference.dto';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from '../schemas/notification-preference.schema';
import { NotificationChannel } from '../types/notification.types';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreferenceDocument>,
  ) {}

  async getPreferences(userId: string) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    return preferences;
  }

  async updatePreferences(userId: string, updateDto: UpdateNotificationPreferencesDto) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    // Update fields if provided
    if (updateDto.channels !== undefined) {
      // Merge into the existing Map (not replace) so untouched channels are preserved.
      // Normalize incoming keys to lowercase to match the NotificationChannel enum values.
      Object.entries(updateDto.channels).forEach(([key, value]) => {
        const normalizedKey = key.toLowerCase() as NotificationChannel;
        if (Object.values(NotificationChannel).includes(normalizedKey)) {
          preferences.channels.set(normalizedKey, value);
        }
      });
      preferences.markModified('channels');
    }

    if (updateDto.globalPushEnabled !== undefined) {
      preferences.globalPushEnabled = updateDto.globalPushEnabled;
    }

    if (updateDto.globalEmailEnabled !== undefined) {
      preferences.globalEmailEnabled = updateDto.globalEmailEnabled;
    }

    if (updateDto.globalSmsEnabled !== undefined) {
      preferences.globalSmsEnabled = updateDto.globalSmsEnabled;
    }

    if (updateDto.quietHours !== undefined) {
      preferences.quietHours = updateDto.quietHours;
    }

    if (updateDto.language !== undefined) {
      preferences.language = updateDto.language;
    }

    if (updateDto.timezone !== undefined) {
      preferences.timezone = updateDto.timezone;
    }

    if (updateDto.locationPreferences !== undefined) {
      preferences.locationPreferences = updateDto.locationPreferences;
    }

    return preferences.save();
  }

  async addDeviceToken(userId: string, deviceToken: string) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    // Add token if not already present
    if (!preferences.deviceTokens.includes(deviceToken)) {
      preferences.deviceTokens.push(deviceToken);
      await preferences.save();
      this.logger.log(`Added device token for user ${userId}`);
    }

    return preferences;
  }

  async removeDeviceToken(userId: string, deviceToken: string) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    // Remove token if present
    const tokenIndex = preferences.deviceTokens.indexOf(deviceToken);
    if (tokenIndex > -1) {
      preferences.deviceTokens.splice(tokenIndex, 1);
      await preferences.save();
      this.logger.log(`Removed device token for user ${userId}`);
    }

    return preferences;
  }

  async updateDeviceTokens(userId: string, deviceTokens: string[]) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    preferences.deviceTokens = Array.from(new Set(deviceTokens)); // Remove duplicates
    return preferences.save();
  }

  async enableChannel(
    userId: string,
    channel: NotificationChannel,
    types: { push?: boolean; email?: boolean; sms?: boolean },
  ) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    const currentChannelPrefs = preferences.channels.get(channel) ?? {
      push: true,
      email: true,
      sms: false,
    };

    preferences.channels.set(channel, {
      push: types.push ?? currentChannelPrefs.push,
      email: types.email ?? currentChannelPrefs.email,
      sms: types.sms ?? currentChannelPrefs.sms,
    });

    return preferences.save();
  }

  async disableChannel(
    userId: string,
    channel: NotificationChannel,
    types: { push?: boolean; email?: boolean; sms?: boolean },
  ) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    const currentChannelPrefs = preferences.channels.get(channel) ?? {
      push: true,
      email: true,
      sms: false,
    };

    preferences.channels.set(channel, {
      push: types.push !== undefined ? !types.push : currentChannelPrefs.push,
      email: types.email !== undefined ? !types.email : currentChannelPrefs.email,
      sms: types.sms !== undefined ? !types.sms : currentChannelPrefs.sms,
    });

    return preferences.save();
  }

  async setQuietHours(
    userId: string,
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    },
  ) {
    // Validate and normalize quiet hours configuration
    const validatedQuietHours = this.validateQuietHoursConfig(quietHours);
    if (!validatedQuietHours) {
      throw new Error('Invalid quiet hours configuration provided');
    }

    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    preferences.quietHours = validatedQuietHours;

    this.logger.log(
      `Updated quiet hours for user ${userId}: enabled=${validatedQuietHours.enabled}, ` +
        `start=${validatedQuietHours.startTime}, end=${validatedQuietHours.endTime}, ` +
        `timezone=${validatedQuietHours.timezone}`,
    );

    return preferences.save();
  }

  async addSavedLocation(
    userId: string,
    location: {
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    },
  ) {
    let preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    preferences ??= await this.createDefaultPreferences(userId);

    preferences.locationPreferences ??= {
      radius: 5,
      enableNearbyOffers: true,
      savedLocations: [],
    };

    preferences.locationPreferences.savedLocations.push(location);
    return preferences.save();
  }

  async removeSavedLocation(userId: string, locationName: string) {
    const preferences = await this.preferencesModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!preferences || !preferences.locationPreferences) {
      return preferences ?? this.createDefaultPreferences(userId);
    }

    preferences.locationPreferences.savedLocations =
      preferences.locationPreferences.savedLocations.filter(loc => loc.name !== locationName);

    return preferences.save();
  }

  async canSendNotification(
    userId: string,
    channel: NotificationChannel,
    type: 'push' | 'email' | 'sms',
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId);

    // Check global settings first
    switch (type) {
      case 'push':
        if (!preferences.globalPushEnabled) {
          return false;
        }
        break;
      case 'email':
        if (!preferences.globalEmailEnabled) {
          return false;
        }
        break;
      case 'sms':
        if (!preferences.globalSmsEnabled) {
          return false;
        }
        break;
    }

    // Check channel-specific settings
    const channelPrefs = preferences.channels.get(channel);
    if (!channelPrefs) {
      return true;
    } // Default to true if no specific preference

    return channelPrefs[type] || false;
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);

      if (preferences.quietHours?.enabled !== true) {
        return false;
      }

      const { startTime, endTime, timezone } = preferences.quietHours;

      // Validate timezone format
      if (!this.isValidTimezone(timezone)) {
        this.logger.warn(`Invalid timezone '${timezone}' for user ${userId}, falling back to UTC`);
        return this.checkQuietHoursInTimezone(startTime, endTime, 'UTC');
      }

      return this.checkQuietHoursInTimezone(startTime, endTime, timezone);
    } catch (error) {
      this.logger.error(
        `Error checking quiet hours for user ${userId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Fail safe: assume not in quiet hours if there's an error
      return false;
    }
  }

  async getUsersWithDeviceTokens(userIds?: string[]): Promise<Map<string, string[]>> {
    const query: FilterQuery<NotificationPreferenceDocument> = {};
    if (userIds) {
      query.userId = { $in: userIds.map(id => new Types.ObjectId(id)) };
    }

    const preferences = await this.preferencesModel
      .find(query)
      .select('userId deviceTokens')
      .exec();

    const userTokensMap = new Map<string, string[]>();

    preferences.forEach(pref => {
      if ((pref.deviceTokens?.length ?? 0) > 0) {
        userTokensMap.set(pref.userId.toString(), pref.deviceTokens);
      }
    });

    return userTokensMap;
  }

  async cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
    if (invalidTokens.length === 0) {
      return;
    }

    await this.preferencesModel.updateMany(
      { deviceTokens: { $in: invalidTokens } },
      { $pullAll: { deviceTokens: invalidTokens } },
    );

    this.logger.log(`Cleaned up ${invalidTokens.length} invalid device tokens`);
  }

  /**
   * Validates if a timezone string is a valid IANA timezone identifier
   * @param timezone - The timezone string to validate
   * @returns boolean indicating if the timezone is valid
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      if (!timezone || typeof timezone !== 'string') {
        return false;
      }

      // Use Luxon's DateTime to validate the timezone
      DateTime.now().setZone(timezone);
      return DateTime.now().setZone(timezone).isValid;
    } catch (error) {
      // Log the specific timezone validation error for debugging
      this.logger.debug(
        `Timezone validation failed for '${timezone}': ${(error as Error).message}`,
        {
          timezone,
          errorType: (error as Error).constructor.name,
          context: 'timezone_validation',
        },
      );
      return false;
    }
  }

  /**
   * Checks if current time in the specified timezone falls within quiet hours
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @param timezone - IANA timezone identifier
   * @returns boolean indicating if currently in quiet hours
   */
  private checkQuietHoursInTimezone(startTime: string, endTime: string, timezone: string): boolean {
    try {
      // Get current time in the specified timezone
      const now = DateTime.now().setZone(timezone);

      if (!now.isValid) {
        this.logger.warn(`Failed to get current time in timezone ${timezone}`);
        return false;
      }

      // Parse start and end times
      const [startHour, startMinute] = this.parseTimeString(startTime);
      const [endHour, endMinute] = this.parseTimeString(endTime);

      if (startHour === null || startMinute === null || endHour === null || endMinute === null) {
        this.logger.warn(`Invalid time format: start=${startTime}, end=${endTime}`);
        return false;
      }

      // Create DateTime objects for start and end times in the same timezone
      const startDateTime = now.set({
        hour: startHour,
        minute: startMinute,
        second: 0,
        millisecond: 0,
      });

      let endDateTime = now.set({
        hour: endHour,
        minute: endMinute,
        second: 0,
        millisecond: 0,
      });

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (startDateTime > endDateTime) {
        // If current time is before midnight and after start time
        if (now >= startDateTime) {
          return true;
        }
        // If current time is after midnight and before end time
        // Move end time to next day for comparison
        endDateTime = endDateTime.plus({ days: 1 });
        const nowPlusDay = now.plus({ days: 1 });
        return nowPlusDay <= endDateTime;
      }
      // Normal quiet hours within the same day
      return now >= startDateTime && now <= endDateTime;
    } catch (error) {
      this.logger.error(
        `Error in checkQuietHoursInTimezone: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return false;
    }
  }

  /**
   * Parses time string in HH:MM format to hour and minute numbers
   * @param timeString - Time string in HH:MM format
   * @returns tuple of [hour, minute] or [null, null] if invalid
   */
  private parseTimeString(timeString: string): [number | null, number | null] {
    try {
      if (!timeString || typeof timeString !== 'string') {
        return [null, null];
      }

      const timeParts = timeString.trim().split(':');
      if (timeParts.length !== 2) {
        return [null, null];
      }

      const [hourPart, minutePart] = timeParts;
      if (hourPart === undefined || minutePart === undefined) {
        return [null, null];
      }

      const hour = Number.parseInt(hourPart, 10);
      const minute = Number.parseInt(minutePart, 10);

      // Validate hour and minute ranges
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return [null, null];
      }

      return [hour, minute];
    } catch {
      this.logger.warn(`Time string parsing failed for '${timeString}'`, {
        timeString,
        context: 'time_parsing',
      });
      return [null, null];
    }
  }

  /**
   * Gets a list of commonly used timezones for user selection
   * Useful for frontend timezone selection components
   * @returns Array of timezone objects with label and value
   */
  getCommonTimezones(): Array<{ label: string; value: string; offset: string }> {
    const commonTimezones = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
    ];

    return commonTimezones.map(tz => {
      try {
        const dt = DateTime.now().setZone(tz);
        return {
          label: `${tz.replace('_', ' ')} (${dt.offsetNameShort})`,
          value: tz,
          offset: dt.offsetNameShort ?? '+00:00',
        };
      } catch (error) {
        // Log timezone processing errors and provide fallback
        this.logger.error(
          `Failed to process timezone '${tz}' in common list: ${(error as Error).message}`,
          {
            timezone: tz,
            errorType: (error as Error).constructor.name,
            stack: (error as Error).stack,
            context: 'common_timezone_processing',
          },
        );
        return {
          label: tz,
          value: tz,
          offset: '+00:00',
        };
      }
    });
  }

  /**
   * Validates and normalizes quiet hours data
   * @param quietHours - The quiet hours configuration to validate
   * @returns Validated quiet hours configuration or null if invalid
   */
  validateQuietHoursConfig(quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  }): {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  } | null {
    try {
      if (typeof quietHours.enabled !== 'boolean') {
        return null;
      }

      if (!quietHours.enabled) {
        return quietHours; // If disabled, other fields don't matter
      }

      // Validate time formats
      const [startHour, startMinute] = this.parseTimeString(quietHours.startTime);
      const [endHour, endMinute] = this.parseTimeString(quietHours.endTime);

      if (startHour === null || startMinute === null || endHour === null || endMinute === null) {
        this.logger.warn('Invalid time format in quiet hours configuration');
        return null;
      }

      // Validate timezone
      if (!this.isValidTimezone(quietHours.timezone)) {
        this.logger.warn(`Invalid timezone in quiet hours: ${quietHours.timezone}`);
        return null;
      }

      // Normalize time format to ensure consistent HH:MM format
      const normalizedStartTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const normalizedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      return {
        enabled: quietHours.enabled,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        timezone: quietHours.timezone,
      };
    } catch (error) {
      this.logger.error(
        `Error validating quiet hours config: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private async createDefaultPreferences(userId: string) {
    const defaultChannels = new Map([
      [NotificationChannel.ORDER_UPDATES, { push: true, email: true, sms: false }],
      [NotificationChannel.PICKUP_REMINDERS, { push: true, email: true, sms: true }],
      [NotificationChannel.OFFERS, { push: true, email: false, sms: false }],
      [NotificationChannel.MARKETING, { push: false, email: true, sms: false }],
      [NotificationChannel.SECURITY, { push: true, email: true, sms: true }],
      [NotificationChannel.ADMIN, { push: true, email: true, sms: false }],
    ]);

    const preferences = new this.preferencesModel({
      userId: new Types.ObjectId(userId),
      channels: defaultChannels,
      globalPushEnabled: true,
      globalEmailEnabled: true,
      globalSmsEnabled: false,
      deviceTokens: [],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
      locationPreferences: {
        radius: 5,
        enableNearbyOffers: true,
        savedLocations: [],
      },
    });

    await preferences.save();
    this.logger.log(`Created default preferences for user ${userId}`);

    return preferences;
  }
}
