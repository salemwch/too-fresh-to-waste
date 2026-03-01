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
   * Convert a datetime string to UTC.
   *
   * Accepts two formats from clients:
   *  - Local time (no Z / no offset): "2026-01-12T23:20:00"
   *    → interpreted as the given timezone (default: Africa/Tunis)
   *    → converted to UTC
   *  - Already-UTC string (Z suffix): "2026-01-12T22:20:00.000Z"
   *    → returned as-is (no second conversion)
   *  - Explicit offset (e.g., +01:00): "2026-01-12T23:20:00+01:00"
   *    → returned as-is (offset is authoritative)
   *
   * This prevents double-conversion when the frontend sends a UTC string
   * (e.g., after converting Tunisia local → UTC on the client side).
   *
   * @param dateTimeString - ISO string, with or without timezone indicator
   * @param timezone - IANA timezone used only when no suffix present (default: Africa/Tunis)
   * @returns UTC Date object
   *
   * @example
   * // Local time (no Z) — interpreted as Tunisia, converted to UTC
   * TimezoneUtil.toUTC('2026-01-12T23:20:00', 'Africa/Tunis')
   * // → 2026-01-12T22:20:00.000Z
   *
   * // Already UTC (has Z) — returned directly, no re-conversion
   * TimezoneUtil.toUTC('2026-01-12T22:20:00.000Z', 'Africa/Tunis')
   * // → 2026-01-12T22:20:00.000Z  (unchanged)
   */
  static toUTC(dateTimeString: string, timezone: string = this.DEFAULT_TIMEZONE): Date {
    const hasTimezoneIndicator = /[zZ]$/.test(dateTimeString) || /[+-]\d{2}:\d{2}$/.test(dateTimeString);

    if (hasTimezoneIndicator) {
      // String already carries absolute timezone info — parse it directly as UTC
      const utcDate = new Date(dateTimeString);
      if (isNaN(utcDate.getTime())) {
        throw new Error(`Invalid datetime string: ${dateTimeString}`);
      }
      return utcDate;
    }

    // No timezone indicator → treat as local time in the specified timezone
    const localDateTime = DateTime.fromISO(dateTimeString, { zone: timezone });

    if (!localDateTime.isValid) {
      throw new Error(`Invalid datetime string: ${dateTimeString}. Error: ${localDateTime.invalidReason}`);
    }

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
