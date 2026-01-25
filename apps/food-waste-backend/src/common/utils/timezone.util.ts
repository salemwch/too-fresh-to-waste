import { DateTime } from 'luxon';

/**
 * Timezone Utility Service
 *
 * Handles conversion between local timezones (primarily Africa/Tunis) and UTC.
 *
 * Best Practices:
 * - Always store UTC in database
 * - Accept local timezone from clients
 * - Return UTC to clients (let frontend handle display)
 * - Never hardcode timezone offsets
 */

export class TimezoneUtil {
  /**
   * Default timezone for the application (Tunisia)
   */
  private static readonly DEFAULT_TIMEZONE = 'Africa/Tunis';

  /**
   * Convert a local datetime string to UTC
   *
   * @param localDateTimeString - ISO string or date string in local timezone (e.g., "2026-01-12T23:20:00")
   * @param timezone - IANA timezone (default: Africa/Tunis)
   * @returns UTC Date object
   *
   * @example
   * // User inputs: 23:20 Tunisia time
   * TimezoneUtil.toUTC('2026-01-12T23:20:00', 'Africa/Tunis')
   * // Returns: Date object representing 2026-01-12T22:20:00.000Z (UTC)
   */
  static toUTC(localDateTimeString: string, timezone: string = this.DEFAULT_TIMEZONE): Date {
    // Remove 'Z' or timezone suffix if present (treat as local time)
    const cleanedString = localDateTimeString.replace(/[zZ]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');

    // Parse as local time in the specified timezone
    const localDateTime = DateTime.fromISO(cleanedString, { zone: timezone });

    if (!localDateTime.isValid) {
      throw new Error(`Invalid datetime string: ${localDateTimeString}. Error: ${localDateTime.invalidReason}`);
    }

    // Convert to UTC and return as Date object
    return localDateTime.toUTC().toJSDate();
  }

  /**
   * Convert UTC Date to local timezone string
   *
   * @param utcDate - UTC Date object
   * @param timezone - IANA timezone (default: Africa/Tunis)
   * @returns ISO string in local timezone
   *
   * @example
   * // Database has: 2026-01-12T22:20:00.000Z (UTC)
   * TimezoneUtil.toLocal(new Date('2026-01-12T22:20:00.000Z'), 'Africa/Tunis')
   * // Returns: ISO string in Tunisia local time (offset automatically determined by Luxon)
   */
  static toLocal(utcDate: Date, timezone: string = this.DEFAULT_TIMEZONE): string {
    const utcDateTime = DateTime.fromJSDate(utcDate, { zone: 'UTC' });
    return utcDateTime.setZone(timezone).toISO();
  }

  /**
   * Get current time in a specific timezone
   *
   * @param timezone - IANA timezone (default: Africa/Tunis)
   * @returns Current Date object in UTC
   */
  static now(timezone: string = this.DEFAULT_TIMEZONE): Date {
    return DateTime.now().setZone(timezone).toUTC().toJSDate();
  }

  /**
   * Validate timezone string
   *
   * @param timezone - IANA timezone string
   * @returns true if valid, false otherwise
   */
  static isValidTimezone(timezone: string): boolean {
    return DateTime.local().setZone(timezone).isValid;
  }

  /**
   * Get start of day (00:00:00) in timezone
   *
   * @param date - Date to get start of day for
   * @param timezone - IANA timezone (default: Africa/Tunis)
   * @returns UTC Date object representing start of day in the specified timezone
   *
   * @example
   * // Get start of day for 2026-01-20 in Tunisia
   * TimezoneUtil.getStartOfDay(new Date('2026-01-20T15:30:00Z'))
   * // Returns: UTC Date representing midnight (00:00:00) in Africa/Tunis timezone
   * // Note: UTC offset is dynamically calculated by Luxon (handles DST automatically)
   */
  static getStartOfDay(date: Date, timezone: string = this.DEFAULT_TIMEZONE): Date {
    const localDateTime = DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(timezone);
    return localDateTime.startOf('day').toUTC().toJSDate();
  }

  /**
   * Get end of day (23:59:59.999) in timezone
   *
   * @param date - Date to get end of day for
   * @param timezone - IANA timezone (default: Africa/Tunis)
   * @returns UTC Date object representing end of day in the specified timezone
   *
   * @example
   * // Get end of day for 2026-01-20 in Tunisia
   * TimezoneUtil.getEndOfDay(new Date('2026-01-20T15:30:00Z'))
   * // Returns: UTC Date representing 23:59:59.999 in Africa/Tunis timezone
   * // Note: UTC offset is dynamically calculated by Luxon (handles DST automatically)
   */
  static getEndOfDay(date: Date, timezone: string = this.DEFAULT_TIMEZONE): Date {
    const localDateTime = DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(timezone);
    return localDateTime.endOf('day').toUTC().toJSDate();
  }
}
