/**
 * MongoDB Migration: Rename VotingCycle fields for clarity
 *
 * Renames:
 *   communityGoalProgress → seasonBagProgress
 *   communityGoalTarget   → seasonBagTarget
 *   communityGoalMetAt    → seasonGoalMetAt
 *
 * Safe to run multiple times — $rename is a no-op when the source field
 * does not exist, and we filter on documents that still have the old name.
 *
 * Usage:
 *   pnpm ts-node scripts/rename-voting-cycle-fields.ts
 *   DATABASE_URL="mongodb://..." pnpm ts-node scripts/rename-voting-cycle-fields.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'mongodb://localhost:27017/foodwaste';

const COLLECTION = 'votingcycles';

const RENAMES: Array<{ from: string; to: string }> = [
  { from: 'communityGoalProgress', to: 'seasonBagProgress' },
  { from: 'communityGoalTarget', to: 'seasonBagTarget' },
  { from: 'communityGoalMetAt', to: 'seasonGoalMetAt' },
];

async function run(): Promise<void> {
  console.log(`Connecting to ${DATABASE_URL.replace(/\/\/[^@]+@/, '//<redacted>@')}…`);
  await mongoose.connect(DATABASE_URL);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No database connection');
  }

  const collection = db.collection(COLLECTION);
  const totalDocs = await collection.countDocuments();
  console.log(`Collection "${COLLECTION}" has ${totalDocs} document(s).`);

  for (const { from, to } of RENAMES) {
    const matching = await collection.countDocuments({ [from]: { $exists: true } });
    if (matching === 0) {
      console.log(`  ✓ ${from} → ${to}: no documents to update (already migrated or empty).`);
      continue;
    }

    const result = await collection.updateMany(
      { [from]: { $exists: true } },
      { $rename: { [from]: to } },
    );
    console.log(`  ✓ ${from} → ${to}: ${result.modifiedCount}/${matching} document(s) updated.`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
