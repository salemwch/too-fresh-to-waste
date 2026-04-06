# 📱 Database Migration Scripts

This directory contains database migration scripts for the Food Waste Backend
application.

## Table of Contents

- [Overview](#overview)
- [Available Migrations](#available-migrations)
- [Running Migrations](#running-migrations)
- [Migration Best Practices](#migration-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Migration scripts are used to transform existing data in the database to match
new schema requirements or business logic changes. All migrations support
**dry-run mode** by default to preview changes before applying them.

### Key Features

- ✅ **Dry-run mode by default** - Preview changes without modifying data
- ✅ **Comprehensive logging** - All operations logged to files in
  `migration-logs/`
- ✅ **Batch processing** - Handles large datasets efficiently
- ✅ **Error handling** - Graceful error handling with detailed error reports
- ✅ **Audit trail** - All migrations add entries to user audit logs
- ✅ **Rollback support** - Can identify and revert changes if needed

---

## Available Migrations

### 1. Phone Number Normalization

**File:** `normalize-phone-numbers.ts`

**Purpose:** Normalizes all existing phone numbers in the database to E.164
international format using `libphonenumber-js`.

**What it does:**

- Finds all users with phone numbers
- Validates and normalizes phone numbers to E.164 format (+21620123456)
- Updates database with normalized values
- Adds audit log entries for tracking
- Generates comprehensive migration report

**When to run:**

- After initial deployment of phone verification feature
- After importing users from external systems
- When phone number format inconsistencies are detected

**Configuration:**

- Default Country: Tunisia (TN)
- Batch Size: 100 users per batch
- Supported formats: E.164, national, international

---

## Running Migrations

### Prerequisites

Ensure you have:

1. Node.js 18+ installed
2. pnpm package manager
3. Access to the MongoDB database
4. Valid `.env` file with `DATABASE_URL` configured

### Basic Usage

#### 1. Dry Run (Preview Changes)

**Always run a dry-run first** to preview what changes will be made:

```bash
# Using pnpm script (recommended)
pnpm migration:normalize-phones

# Or using npx directly
npx ts-node scripts/migrations/normalize-phone-numbers.ts
```

This will:

- Connect to the database
- Analyze all phone numbers
- Show what would be changed
- Generate a preview report
- **NOT modify any data**

#### 2. Execute Migration

After reviewing the dry-run results, execute the migration:

```bash
# Using pnpm script (recommended)
pnpm migration:normalize-phones:execute

# Or using npx directly
npx ts-node scripts/migrations/normalize-phone-numbers.ts --execute
```

This will:

- Apply all changes to the database
- Update user records
- Add audit log entries
- Generate final migration report

### Migration Output

Each migration generates:

1. **Console output** - Real-time progress in terminal
2. **Log file** - Detailed log saved to
   `migration-logs/phone-normalization-[timestamp].log`
3. **Summary report** - Statistics and results at the end

Example output:

```
=========================================
📱 Phone Number Normalization Migration
=========================================
Mode: DRY RUN
Default Country: TN
Batch Size: 100
=========================================

[2024-01-15T10:30:00.000Z] [INFO] Connecting to MongoDB: mongodb://***:***@...
[2024-01-15T10:30:01.000Z] [SUCCESS] Successfully connected to MongoDB
[2024-01-15T10:30:01.500Z] [INFO] Total users in database: 1500
[2024-01-15T10:30:02.000Z] [INFO] Users with phone numbers: 850
[2024-01-15T10:30:02.500Z] [INFO] Processing batch 1 (100 users)
[2024-01-15T10:30:03.000Z] [SUCCESS] [DRY RUN] Would update user john@example.com: 20123456 → +21620123456
...

=========================================
📊 MIGRATION SUMMARY
=========================================
Mode: DRY RUN (no changes applied)
Total users: 1500
Users with phone numbers: 850
Already normalized: 650
Successful updates: 195
Failed updates: 5
Skipped users: 0
=========================================

ℹ️  This was a DRY RUN. No changes were made to the database.
   To execute the migration, run:
   pnpm migration:normalize-phones:execute
```

---

## Migration Best Practices

### Before Running a Migration

1. **Backup your database**

   ```bash
   # Example MongoDB backup
   mongodump --uri="your-mongodb-uri" --out=./backup-$(date +%Y%m%d)
   ```

2. **Run in dry-run mode first**

   ```bash
   pnpm migration:normalize-phones
   ```

3. **Review the dry-run output**
   - Check the log file in `migration-logs/`
   - Verify the changes make sense
   - Note any errors or warnings

4. **Test on staging environment**
   - Run on a copy of production data first
   - Verify application works correctly after migration

### During Migration

1. **Monitor the output**
   - Watch for errors or warnings
   - Check batch processing progress
   - Note any failed updates

2. **Don't interrupt the process**
   - Let the migration complete
   - Each batch is processed atomically
   - Interrupting may leave data in inconsistent state

### After Migration

1. **Review the final report**
   - Check success/failure counts
   - Review any errors
   - Verify expected changes

2. **Verify application functionality**
   - Test phone verification flow
   - Check user authentication
   - Verify phone number display

3. **Save the log file**
   - Keep for audit trail
   - Reference for troubleshooting
   - Document in change log

4. **Monitor for issues**
   - Watch error logs
   - Check user reports
   - Monitor database performance

---

## Troubleshooting

### Common Issues

#### Issue: "Failed to connect to MongoDB"

**Solution:**

- Check your `.env` file has correct `DATABASE_URL`
- Verify database is running and accessible
- Check network connectivity
- Verify database credentials

```bash
# Test MongoDB connection
mongosh "your-mongodb-uri"
```

#### Issue: "Invalid phone number format"

**Solution:** Some phone numbers cannot be normalized automatically.

**What to do:**

1. Review the error in the log file
2. Manually correct the phone number in the database
3. Re-run the migration

Common causes:

- Invalid phone numbers (wrong format, missing digits)
- Phone numbers from unsupported countries
- Corrupted data

#### Issue: "Migration failed midway"

**Solution:** Migrations are designed to be idempotent (can be run multiple
times safely).

**What to do:**

1. Review the log file to identify the failure point
2. Fix the underlying issue
3. Re-run the migration (it will skip already migrated users)

```bash
# Re-run in dry-run mode first
pnpm migration:normalize-phones

# Then execute again
pnpm migration:normalize-phones:execute
```

#### Issue: "Batch processing too slow"

**Solution:** Adjust the batch size in the migration script.

Edit `normalize-phone-numbers.ts`:

```typescript
const CONFIG = {
  batchSize: 50, // Reduce from 100 to 50
  // ...
};
```

### Getting Help

If you encounter issues:

1. **Check the logs** - `migration-logs/` directory
2. **Review error messages** - Often contain specific solutions
3. **Test on sample data** - Create test users to reproduce issues
4. **Contact the team** - Provide log files and error messages

---

## Advanced Usage

### Custom Configuration

Edit migration scripts to customize:

```typescript
const CONFIG = {
  defaultCountry: 'TN', // Change default country
  batchSize: 100, // Adjust batch size
  dryRun: false, // Force execute mode
  logFile: './custom.log', // Custom log location
};
```

### Programmatic Usage

Import and use migrations in your own scripts:

```typescript
import { migratePhoneNumbers } from './scripts/migrations/normalize-phone-numbers';

async function customMigration() {
  const summary = await migratePhoneNumbers();
  console.log(`Migrated ${summary.successfulUpdates} phone numbers`);
}
```

### Rollback Support

To rollback a migration, create a reverse migration that:

1. Reads the audit log entries created by the original migration
2. Restores the `originalPhone` value from audit log details
3. Updates the database with original values

Example:

```typescript
// Find users migrated by phone normalization
const migratedUsers = await UserModel.find({
  'auditLog.action': 'PHONE_NUMBER_NORMALIZED',
});

// Restore original values
for (const user of migratedUsers) {
  const migrationLog = user.auditLog.find((log) => log.action === 'PHONE_NUMBER_NORMALIZED');

  if (migrationLog?.details?.originalPhone) {
    await UserModel.updateOne(
      { _id: user._id },
      { phoneNumber: migrationLog.details.originalPhone },
    );
  }
}
```

---

## Migration Checklist

Use this checklist when running migrations:

- [ ] Backup database
- [ ] Review migration documentation
- [ ] Run dry-run mode
- [ ] Review dry-run output
- [ ] Test on staging environment
- [ ] Schedule maintenance window (if needed)
- [ ] Execute migration with `--execute` flag
- [ ] Monitor migration progress
- [ ] Review final report
- [ ] Save log files
- [ ] Test application functionality
- [ ] Update change log
- [ ] Monitor for issues

---

## Log Files

Migration logs are saved to `migration-logs/` directory:

```
migration-logs/
├── phone-normalization-1705315800000.log
├── phone-normalization-1705402200000.log
└── ...
```

### Log Format

```
[timestamp] [level] message

Levels: INFO, SUCCESS, WARNING, ERROR
```

### Log Retention

- Keep logs for at least 90 days
- Archive old logs for audit purposes
- Include in backup procedures

---

## Security Considerations

1. **Sensitive Data** - Phone numbers are PII (Personally Identifiable
   Information)
   - Logs mask sensitive data where possible
   - Store logs securely
   - Follow data retention policies

2. **Access Control** - Only authorized personnel should run migrations
   - Require database admin credentials
   - Document who ran which migrations
   - Review changes before execution

3. **Audit Trail** - All migrations create audit log entries
   - Track who, what, when, where
   - Cannot be deleted by regular operations
   - Used for compliance and troubleshooting

---

## Contributing

When creating new migration scripts:

1. Copy the template from `normalize-phone-numbers.ts`
2. Follow naming convention: `action-description.ts`
3. Support dry-run mode by default
4. Include comprehensive logging
5. Add audit log entries
6. Document in this README
7. Test thoroughly before committing

---

**Last Updated:** 2024 **Maintained by:** Food Waste Backend Team
