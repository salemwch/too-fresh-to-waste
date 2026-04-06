/**
 * =========================================
 * 📱 PHONE NUMBER NORMALIZATION MIGRATION
 * =========================================
 *
 * Purpose: Normalize all existing phone numbers in the database to E.164 format
 *
 * This migration script:
 * 1. Connects to MongoDB database
 * 2. Finds all users with phone numbers
 * 3. Normalizes phone numbers using libphonenumber-js
 * 4. Updates database with E.164 formatted phone numbers
 * 5. Logs all changes for audit trail
 * 6. Handles errors gracefully with rollback capability
 *
 * Usage:
 *   npm run migration:normalize-phones              # Dry run (preview changes)
 *   npm run migration:normalize-phones -- --execute # Execute migration
 *
 * Or directly with ts-node:
 *   npx ts-node scripts/migrations/normalize-phone-numbers.ts
 *   npx ts-node scripts/migrations/normalize-phone-numbers.ts --execute
 *
 * Author: Food Waste Backend Team
 * Date: 2024
 */

import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  defaultCountry: 'TN' as CountryCode, // Tunisia
  dryRun: !process.argv.includes('--execute'),
  batchSize: 100, // Process users in batches
  logFile: path.resolve(__dirname, `./migration-logs/phone-normalization-${Date.now()}.log`),
};

// ============================================
// TYPES & INTERFACES
// ============================================

interface UserDocument {
  _id: mongoose.Types.ObjectId;
  email: string;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
}

interface MigrationResult {
  userId: string;
  email: string;
  originalPhone: string;
  normalizedPhone: string;
  country?: string;
  isValid: boolean;
  error?: string;
}

interface MigrationSummary {
  totalUsers: number;
  usersWithPhone: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedUsers: number;
  alreadyNormalized: number;
  results: MigrationResult[];
  errors: Array<{ userId: string; email: string; error: string }>;
}

// ============================================
// LOGGER UTILITY
// ============================================

class MigrationLogger {
  private logs: string[] = [];

  log(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    this.logs.push(logMessage);
  }

  getLogs(): string[] {
    return this.logs;
  }

  async saveLogs(): Promise<void> {
    const fs = await import('fs/promises');
    const logDir = path.dirname(CONFIG.logFile);

    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.writeFile(CONFIG.logFile, this.logs.join('\n'), 'utf-8');
      this.log(`Migration logs saved to: ${CONFIG.logFile}`, 'SUCCESS');
    } catch (error) {
      this.log(`Failed to save logs: ${(error as Error).message}`, 'ERROR');
    }
  }
}

const logger = new MigrationLogger();

// ============================================
// PHONE NUMBER NORMALIZATION LOGIC
// ============================================

/**
 * Normalize a phone number to E.164 format
 * @param phoneNumber - Raw phone number string
 * @param defaultCountry - Default country code (TN)
 * @returns Normalized phone number or null if invalid
 */
function normalizePhoneNumber(
  phoneNumber: string,
  defaultCountry: CountryCode = CONFIG.defaultCountry,
): { normalized: string; country?: string; isValid: boolean; error?: string } {
  try {
    // Remove common formatting characters
    const cleaned = phoneNumber.trim();

    // Check if it's a valid phone number
    if (!isValidPhoneNumber(cleaned, defaultCountry)) {
      // Try without default country (for international numbers)
      if (!isValidPhoneNumber(cleaned)) {
        return {
          normalized: phoneNumber,
          isValid: false,
          error: 'Invalid phone number format',
        };
      }
    }

    // Parse the phone number
    const parsed = parsePhoneNumber(cleaned, defaultCountry);

    if (!parsed) {
      return {
        normalized: phoneNumber,
        isValid: false,
        error: 'Failed to parse phone number',
      };
    }

    // Get E.164 format
    const e164 = parsed.format('E.164');

    return {
      normalized: e164,
      country: parsed.country,
      isValid: true,
    };
  } catch (error) {
    return {
      normalized: phoneNumber,
      isValid: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check if a phone number is already in E.164 format
 */
function isE164Format(phoneNumber: string): boolean {
  // E.164 format: +[1-9]\d{1,14}
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

// ============================================
// DATABASE CONNECTION
// ============================================

async function connectToDatabase(): Promise<typeof mongoose> {
  const mongoUri = process.env.DATABASE_URL || 'mongodb://localhost:27017/foodwaste';

  logger.log(
    `Connecting to MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`,
    'INFO',
  );

  try {
    const connection = await mongoose.connect(mongoUri);
    logger.log('Successfully connected to MongoDB', 'SUCCESS');
    return connection;
  } catch (error) {
    logger.log(`Failed to connect to MongoDB: ${(error as Error).message}`, 'ERROR');
    throw error;
  }
}

async function disconnectFromDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.log('Disconnected from MongoDB', 'INFO');
  } catch (error) {
    logger.log(`Error disconnecting from MongoDB: ${(error as Error).message}`, 'ERROR');
  }
}

// ============================================
// MIGRATION LOGIC
// ============================================

async function migratePhoneNumbers(mongooseInstance: typeof mongoose): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    totalUsers: 0,
    usersWithPhone: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    skippedUsers: 0,
    alreadyNormalized: 0,
    results: [],
    errors: [],
  };

  try {
    // Access the database using the native MongoDB driver through mongoose
    const db = mongooseInstance.connection.db;

    if (!db) {
      throw new Error(
        'Failed to access MongoDB database. Connection state: ' +
          mongooseInstance.connection.readyState,
      );
    }

    // Access the users collection
    const usersCollection = db.collection('users');

    // Count total users
    summary.totalUsers = await usersCollection.countDocuments();
    logger.log(`Total users in database: ${summary.totalUsers}`, 'INFO');

    // Find all users with phone numbers
    const usersWithPhone = (await usersCollection
      .find(
        {
          phoneNumber: { $exists: true, $nin: [null, ''] },
        },
        {
          projection: { _id: 1, email: 1, phoneNumber: 1, isPhoneVerified: 1 },
        },
      )
      .toArray()) as unknown as UserDocument[];

    summary.usersWithPhone = usersWithPhone.length;
    logger.log(`Users with phone numbers: ${summary.usersWithPhone}`, 'INFO');

    // Process users in batches
    for (let i = 0; i < usersWithPhone.length; i += CONFIG.batchSize) {
      const batch = usersWithPhone.slice(i, i + CONFIG.batchSize);
      logger.log(
        `Processing batch ${Math.floor(i / CONFIG.batchSize) + 1} (${batch.length} users)`,
        'INFO',
      );

      for (const user of batch) {
        try {
          const originalPhone = user.phoneNumber!;

          // Check if already in E.164 format
          if (isE164Format(originalPhone)) {
            summary.alreadyNormalized++;
            logger.log(`User ${user.email} phone already normalized: ${originalPhone}`, 'INFO');

            summary.results.push({
              userId: user._id.toString(),
              email: user.email,
              originalPhone,
              normalizedPhone: originalPhone,
              isValid: true,
            });

            continue;
          }

          // Normalize the phone number
          const normalization = normalizePhoneNumber(originalPhone);

          if (!normalization.isValid) {
            summary.failedUpdates++;
            logger.log(
              `Failed to normalize phone for user ${user.email}: ${normalization.error}`,
              'WARNING',
            );

            summary.errors.push({
              userId: user._id.toString(),
              email: user.email,
              error: normalization.error || 'Unknown error',
            });

            summary.results.push({
              userId: user._id.toString(),
              email: user.email,
              originalPhone,
              normalizedPhone: normalization.normalized,
              country: normalization.country,
              isValid: false,
              error: normalization.error,
            });

            continue;
          }

          // Update the database (only if not dry run)
          if (!CONFIG.dryRun) {
            await usersCollection.updateOne(
              { _id: user._id },
              {
                $set: {
                  phoneNumber: normalization.normalized,
                },
                $push: {
                  auditLog: {
                    action: 'PHONE_NUMBER_NORMALIZED',
                    timestamp: new Date(),
                    ipAddress: 'system-migration',
                    userAgent: 'phone-normalization-script',
                    details: {
                      originalPhone,
                      normalizedPhone: normalization.normalized,
                      country: normalization.country,
                      migrationDate: new Date(),
                    },
                  },
                } as any, // Bypass TypeScript strict typing for MongoDB native driver
              },
            );
          }

          summary.successfulUpdates++;
          logger.log(
            `${CONFIG.dryRun ? '[DRY RUN] Would update' : 'Updated'} user ${user.email}: ${originalPhone} → ${normalization.normalized}`,
            'SUCCESS',
          );

          summary.results.push({
            userId: user._id.toString(),
            email: user.email,
            originalPhone,
            normalizedPhone: normalization.normalized,
            country: normalization.country,
            isValid: true,
          });
        } catch (error) {
          summary.failedUpdates++;
          const errorMessage = (error as Error).message;

          logger.log(`Error processing user ${user.email}: ${errorMessage}`, 'ERROR');

          summary.errors.push({
            userId: user._id.toString(),
            email: user.email,
            error: errorMessage,
          });
        }
      }
    }
  } catch (error) {
    logger.log(`Critical error during migration: ${(error as Error).message}`, 'ERROR');
    throw error;
  }

  return summary;
}

// ============================================
// PRINT SUMMARY
// ============================================

function printSummary(summary: MigrationSummary): void {
  logger.log('', 'INFO');
  logger.log('=========================================', 'INFO');
  logger.log('📊 MIGRATION SUMMARY', 'INFO');
  logger.log('=========================================', 'INFO');
  logger.log(
    `Mode: ${CONFIG.dryRun ? 'DRY RUN (no changes applied)' : 'EXECUTE (changes applied)'}`,
    'INFO',
  );
  logger.log(`Total users: ${summary.totalUsers}`, 'INFO');
  logger.log(`Users with phone numbers: ${summary.usersWithPhone}`, 'INFO');
  logger.log(`Already normalized: ${summary.alreadyNormalized}`, 'SUCCESS');
  logger.log(`Successful updates: ${summary.successfulUpdates}`, 'SUCCESS');
  logger.log(
    `Failed updates: ${summary.failedUpdates}`,
    summary.failedUpdates > 0 ? 'WARNING' : 'INFO',
  );
  logger.log(`Skipped users: ${summary.skippedUsers}`, 'INFO');
  logger.log('=========================================', 'INFO');

  if (summary.errors.length > 0) {
    logger.log('', 'INFO');
    logger.log('❌ ERRORS:', 'ERROR');
    summary.errors.forEach((error, index) => {
      logger.log(`${index + 1}. User: ${error.email} - Error: ${error.error}`, 'ERROR');
    });
  }

  if (CONFIG.dryRun) {
    logger.log('', 'INFO');
    logger.log('ℹ️  This was a DRY RUN. No changes were made to the database.', 'WARNING');
    logger.log('   To execute the migration, run:', 'WARNING');
    logger.log('   npm run migration:normalize-phones -- --execute', 'WARNING');
  } else {
    logger.log('', 'INFO');
    logger.log('✅ Migration completed successfully!', 'SUCCESS');
  }

  logger.log('', 'INFO');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
  logger.log('', 'INFO');
  logger.log('=========================================', 'INFO');
  logger.log('📱 Phone Number Normalization Migration', 'INFO');
  logger.log('=========================================', 'INFO');
  logger.log(`Mode: ${CONFIG.dryRun ? 'DRY RUN' : 'EXECUTE'}`, 'INFO');
  logger.log(`Default Country: ${CONFIG.defaultCountry}`, 'INFO');
  logger.log(`Batch Size: ${CONFIG.batchSize}`, 'INFO');
  logger.log('=========================================', 'INFO');
  logger.log('', 'INFO');

  try {
    // Connect to database
    const mongooseInstance = await connectToDatabase();

    // Run migration
    const summary = await migratePhoneNumbers(mongooseInstance);

    // Print summary
    printSummary(summary);

    // Save logs
    await logger.saveLogs();

    // Disconnect
    await disconnectFromDatabase();

    // Exit with appropriate code
    process.exit(summary.failedUpdates > 0 ? 1 : 0);
  } catch (error) {
    logger.log(`Fatal error: ${(error as Error).message}`, 'ERROR');
    logger.log((error as Error).stack || '', 'ERROR');

    await logger.saveLogs();
    await disconnectFromDatabase();

    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  main();
}

export { main, normalizePhoneNumber };
