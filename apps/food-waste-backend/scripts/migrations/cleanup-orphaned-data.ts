import mongoose from 'mongoose';

const MONGODB_URI = process.env['DATABASE_URL'] || 'mongodb://localhost:27017/toofreshtowaste';

interface CleanupResult {
  collection: string;
  orphansFound: number;
  cleaned: number;
  action: string;
}

function safeToString(value: unknown): string | null {
  if (value == null) return null;
  try {
    return String(value);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--execute');

  console.log('=== Orphaned Data Cleanup (Soft-Delete) ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (pass --execute to apply)' : 'EXECUTING'}`);
  console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);

  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('Failed to get database reference');
  }

  const results: CleanupResult[] = [];
  const now = new Date();

  const users = await db.collection('users').find({}, { projection: { _id: 1 } }).toArray();
  const validUserIds = new Set(users.map(u => u._id.toString()));
  console.log(`\nFound ${validUserIds.size} users in the database.\n`);

  // 1. Loyalty accounts — deactivate orphans via isActive: false
  {
    const collection = 'loyaltyaccounts';
    const docs = await db
      .collection(collection)
      .find({ isActive: { $ne: false } }, { projection: { _id: 1, userId: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.userId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        { $set: { isActive: false, lastActivity: now } },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'deactivated' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} deactivated`}`);
  }

  // 2. Notification preferences — sanitize orphans (clear tokens, disable channels)
  {
    const collection = 'notification_preferences';
    const docs = await db
      .collection(collection)
      .find({}, { projection: { _id: 1, userId: 1, deviceTokens: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.userId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        {
          $set: {
            deviceTokens: [],
            globalPushEnabled: false,
            globalEmailEnabled: false,
            globalSmsEnabled: false,
          },
        },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'sanitized' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} sanitized`}`);
  }

  // 3. Favorites — deactivate orphans via isActive: false
  {
    const collection = 'favorites';
    const docs = await db
      .collection(collection)
      .find({ isActive: true }, { projection: { _id: 1, userId: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.userId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        { $set: { isActive: false } },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'deactivated' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} deactivated`}`);
  }

  // 4. User donations — soft-delete orphans
  {
    const collection = 'userdonations';
    const docs = await db
      .collection(collection)
      .find({ isDeleted: { $ne: true } }, { projection: { _id: 1, userId: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.userId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        { $set: { isDeleted: true, deletedAt: now, deletedBy: 'migration-cleanup' } },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'soft-deleted' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} soft-deleted`}`);
  }

  // 5. Reviews — soft-delete orphans with cascade marker
  {
    const collection = 'reviews';
    const docs = await db
      .collection(collection)
      .find({ isDeleted: { $ne: true } }, { projection: { _id: 1, reviewerId: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.reviewerId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            deletedBy: 'migration-cleanup',
            deletionReason: 'user_account_deleted',
          },
        },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'soft-deleted' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} soft-deleted`}`);
  }

  // 6. Orders — ANONYMIZE only (preserve business records)
  {
    const collection = 'orders';
    const docs = await db
      .collection(collection)
      .find({ anonymized: { $ne: true } }, { projection: { _id: 1, customerId: 1 } })
      .toArray();

    const orphanIds = docs
      .filter(d => {
        const id = safeToString(d.customerId);
        return !id || !validUserIds.has(id);
      })
      .map(d => d._id);

    let cleaned = 0;
    if (orphanIds.length > 0 && !dryRun) {
      const res = await db.collection(collection).updateMany(
        { _id: { $in: orphanIds } },
        {
          $set: {
            'customerInfo.name': 'Anonymous User',
            'customerInfo.email': 'deleted@privacy.local',
            'customerInfo.phone': null,
            'pickupDetails.contactPhone': null,
            anonymized: true,
            anonymizedAt: now,
            anonymizationReason: 'Orphan cleanup — user record missing',
          },
        },
      );
      cleaned = res.modifiedCount;
    }

    results.push({ collection, orphansFound: orphanIds.length, cleaned: dryRun ? 0 : cleaned, action: 'anonymized' });
    console.log(`[${collection}] ${orphanIds.length} orphaned${dryRun ? ' (dry run)' : ` -> ${cleaned} anonymized`}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log('Collection                 | Orphans | Cleaned | Action');
  console.log('---------------------------|---------|---------|------------');
  for (const r of results) {
    console.log(
      `${r.collection.padEnd(27)}| ${String(r.orphansFound).padEnd(8)}| ${String(r.cleaned).padEnd(8)}| ${r.action}`,
    );
  }

  const totalOrphans = results.reduce((sum, r) => sum + r.orphansFound, 0);
  const totalCleaned = results.reduce((sum, r) => sum + r.cleaned, 0);
  console.log('---------------------------|---------|---------|------------');
  console.log(
    `${'TOTAL'.padEnd(27)}| ${String(totalOrphans).padEnd(8)}| ${String(totalCleaned).padEnd(8)}|`,
  );

  if (dryRun && totalOrphans > 0) {
    console.log('\n⚠ DRY RUN — no changes applied. Run with --execute to clean up.');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
