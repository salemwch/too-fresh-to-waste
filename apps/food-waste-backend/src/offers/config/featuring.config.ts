/**
 * Auto-Featuring Configuration
 *
 * This module defines constants and configuration for the automatic featuring system.
 * Offers are automatically featured when they meet urgency criteria.
 *
 * Business Rules:
 * - Minimum Existence: Offer must have existed for at least 30 minutes before auto-featuring
 * - Urgency Threshold: Offer is featured when it has 3 hours or less remaining
 * - Cron Schedule: Runs every 1 minute to update featuring status
 *
 * @module featuring.config
 */

/**
 * Minimum time (in hours) an offer must exist before it can be auto-featured
 * This prevents gaming the system by creating very short offers that immediately appear urgent
 *
 * Default: 0.5 hours (30 minutes) - reduced for faster featuring
 * Configurable via: AUTO_FEATURE_MIN_EXISTENCE_HOURS env variable
 */
export const MIN_EXISTENCE_HOURS = parseFloat(
  process.env['AUTO_FEATURE_MIN_EXISTENCE_HOURS'] ?? '0.5',
);

/**
 * Time threshold (in hours) for considering an offer "urgent"
 * When an offer has this many hours or less remaining, it becomes auto-featured
 *
 * Default: 3 hours - increased for more offers to be featured
 * Configurable via: AUTO_FEATURE_URGENCY_HOURS env variable
 */
export const URGENCY_THRESHOLD_HOURS = parseFloat(process.env['AUTO_FEATURE_URGENCY_HOURS'] ?? '3');

/**
 * Cron schedule for auto-featuring job
 *
 * Default: Every 1 minute ('* * * * *') - more frequent for faster response
 * Configurable via: AUTO_FEATURE_CRON_SCHEDULE env variable
 */
export const AUTO_FEATURE_CRON_SCHEDULE =
  process.env['AUTO_FEATURE_CRON_SCHEDULE'] ?? '*/1 * * * *';

/**
 * Enable/disable auto-featuring system
 * Useful for testing or temporary disabling
 *
 * Default: true
 * Configurable via: AUTO_FEATURE_ENABLED env variable
 */
export const AUTO_FEATURE_ENABLED = process.env['AUTO_FEATURE_ENABLED'] !== 'false';

// =============================================================================
// DERIVED CONSTANTS (calculated from above)
// =============================================================================

/**
 * Minimum existence time in milliseconds
 * Used for database queries: createdAt <= (now - MIN_EXISTENCE_MS)
 */
export const MIN_EXISTENCE_MS = MIN_EXISTENCE_HOURS * 60 * 60 * 1000;

/**
 * Urgency threshold in milliseconds
 * Used for database queries: availableUntil <= (now + URGENCY_THRESHOLD_MS)
 */
export const URGENCY_THRESHOLD_MS = URGENCY_THRESHOLD_HOURS * 60 * 60 * 1000;

// =============================================================================
// VALIDATION
// =============================================================================

// Validate configuration on module load
if (MIN_EXISTENCE_HOURS < 0 || MIN_EXISTENCE_HOURS > 24) {
  throw new Error(`Invalid MIN_EXISTENCE_HOURS: ${MIN_EXISTENCE_HOURS}. Must be between 0 and 24.`);
}

if (URGENCY_THRESHOLD_HOURS < 0 || URGENCY_THRESHOLD_HOURS > 24) {
  throw new Error(
    `Invalid URGENCY_THRESHOLD_HOURS: ${URGENCY_THRESHOLD_HOURS}. Must be between 0 and 24.`,
  );
}

// Note: URGENCY_THRESHOLD_HOURS >= MIN_EXISTENCE_HOURS is now intentional
// for faster featuring behavior. Offers become urgent-featured sooner.

// =============================================================================
// LOGGING
// =============================================================================

import { Logger } from '@nestjs/common';

const featuringLogger = new Logger('AutoFeaturingConfig');

if (AUTO_FEATURE_ENABLED) {
  featuringLogger.log(
    `Auto-Featuring enabled — minExistence: ${MIN_EXISTENCE_HOURS}h, urgency: ${URGENCY_THRESHOLD_HOURS}h, cron: ${AUTO_FEATURE_CRON_SCHEDULE}`,
  );
} else {
  featuringLogger.warn('Auto-Featuring is DISABLED');
}
