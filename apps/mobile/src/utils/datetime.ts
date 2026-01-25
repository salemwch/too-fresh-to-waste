/**
 * DateTime Utility Functions
 * Display formatting for offer times (consumer-only app)
 *
 * CRITICAL: All times displayed in Africa/Tunis timezone (NOT device timezone)
 * - Backend stores: UTC
 * - Display shows: Tunisia local time (IANA timezone, DST-aware)
 * - Never hardcodes UTC+1 (handles DST changes automatically)
 */

/**
 * App timezone (Tunisia)
 * Uses IANA timezone identifier for DST-aware conversions
 */
const APP_TIMEZONE = 'Africa/Tunis';

/**
 * Format UTC string for display in Tunisia timezone.
 * ALWAYS displays in Africa/Tunis timezone, regardless of device settings.
 *
 * ✅ Backend stores: "2026-01-11T18:50:00.000Z" (UTC)
 * ✅ App displays: "19:50" (Africa/Tunis time, DST-aware)
 *
 * @param utcString - ISO 8601 UTC timestamp from backend
 * @param options - Optional formatting options
 * @returns Formatted time string in Tunisia timezone
 *
 * @example
 * formatTime("2026-01-11T18:50:00.000Z");
 * // Returns: "19:50" (Tunisia time, regardless of device timezone)
 *
 * formatTime("2026-01-11T18:50:00.000Z", { showDate: true });
 * // Returns: "Jan 11, 2026, 19:50" (Tunisia time)
 */
export function formatTime(
  utcString: string,
  options?: { showDate?: boolean },
): string {
  const date = new Date(utcString);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid UTC timestamp: ${utcString}`);
  }

  // ✅ CRITICAL: Use explicit timezone (Africa/Tunis), not device timezone
  // This ensures all users see Tunisia time, regardless of their phone's timezone setting
  if (options?.showDate) {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: APP_TIMEZONE, // ✅ Explicit Tunisia timezone (DST-aware)
    });
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: APP_TIMEZONE, // ✅ Explicit Tunisia timezone (DST-aware)
  });
}

/**
 * Get current time in Tunisia timezone
 * Useful for displaying "now" in the app
 */
export function getCurrentTunisiaTime(): Date {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: APP_TIMEZONE,
    }),
  );
}

/**
 * Check if an offer has expired (Tunisia time)
 * @param availableUntil - UTC timestamp from backend
 * @returns true if offer has expired in Tunisia timezone
 */
export function isExpired(availableUntil: string): boolean {
  const expiryDate = new Date(availableUntil);
  const now = getCurrentTunisiaTime();
  return expiryDate < now;
}

/**
 * Get time remaining until offer expires (Tunisia time)
 * @param availableUntil - UTC timestamp from backend
 * @returns Object with hours and minutes remaining, or null if expired
 */
export function getTimeRemaining(availableUntil: string): {
  hours: number;
  minutes: number;
  totalMinutes: number;
} | null {
  const expiryDate = new Date(availableUntil);
  const now = getCurrentTunisiaTime();
  const diff = expiryDate.getTime() - now.getTime();

  if (diff <= 0) {
    return null; // Expired
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return { hours, minutes, totalMinutes };
}
