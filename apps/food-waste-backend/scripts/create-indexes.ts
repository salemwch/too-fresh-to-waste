/**
 * Enterprise-Grade MongoDB Index Creation Script
 *
 * This script creates all necessary indexes for optimal query performance.
 * Run this script BEFORE deploying to production.
 *
 * Usage:
 * ```bash
 * # Development
 * pnpm ts-node scripts/create-indexes.ts
 *
 * # Production (with connection string)
 * DATABASE_URL="mongodb://..." pnpm ts-node scripts/create-indexes.ts
 * ```
 *
 * IMPORTANT:
 * - Run during low-traffic periods (index creation blocks writes)
 * - Monitor index creation progress: db.currentOp({ $or: [{ op: "command", "command.createIndexes": { $exists: true } }] })
 * - Large collections (1M+ docs) may take 10-30 minutes per index
 */

import type { IndexSpecification } from 'mongodb';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ALL_INDEXES } from '../src/common/constants/database-indexes.constant';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'mongodb://localhost:27017/foodwaste';

interface IndexCreationResult {
  collection: string;
  indexName: string;
  status: 'created' | 'already_exists' | 'error';
  error?: string;
  timeTaken?: number;
}

/**
 * Create indexes for a specific collection
 */
async function createIndexesForCollection(
  collectionName: string,
  indexes: { fields: Record<string, 1 | -1 | string>; options?: any }[],
): Promise<IndexCreationResult[]> {
  const results: IndexCreationResult[] = [];
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database connection not established');
  }

  const collection = db.collection(collectionName);

  console.log(`\n📂 Collection: ${collectionName}`);
  console.log(`   Creating ${indexes.length} indexes...`);

  for (const indexDef of indexes) {
    const indexName = indexDef.options?.name || Object.keys(indexDef.fields).join('_');
    const startTime = Date.now();

    try {
      // Check if index already exists
      const existingIndexes = await collection.indexes();
      const indexExists = existingIndexes.some(idx => idx.name === indexName);

      if (indexExists) {
        console.log(`   ⏭️  ${indexName} - Already exists`);
        results.push({
          collection: collectionName,
          indexName,
          status: 'already_exists',
          timeTaken: Date.now() - startTime,
        });
        continue;
      }

      // Create index
      // Cast: the constant file types fields as Record<string, 1|-1|string>
      // for readability; the driver wants its own IndexSpecification union.
      await collection.createIndex(indexDef.fields as IndexSpecification, indexDef.options);

      const timeTaken = Date.now() - startTime;
      console.log(`   ✅ ${indexName} - Created (${timeTaken}ms)`);

      results.push({
        collection: collectionName,
        indexName,
        status: 'created',
        timeTaken,
      });
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      console.error(
        `   ❌ ${indexName} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      results.push({
        collection: collectionName,
        indexName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timeTaken,
      });
    }
  }

  return results;
}

/**
 * Verify index creation
 */
async function verifyIndexes(
  collectionName: string,
  expectedIndexes: { fields: Record<string, 1 | -1 | string>; options?: any }[],
): Promise<void> {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database connection not established');
  }

  const collection = db.collection(collectionName);
  const existingIndexes = await collection.indexes();

  console.log(`\n🔍 Verifying ${collectionName} indexes:`);
  console.log(`   Expected: ${expectedIndexes.length}`);
  console.log(`   Found: ${existingIndexes.length - 1}`); // -1 for default _id index

  for (const indexDef of expectedIndexes) {
    const indexName = indexDef.options?.name || Object.keys(indexDef.fields).join('_');
    const exists = existingIndexes.some(idx => idx.name === indexName);

    if (exists) {
      console.log(`   ✅ ${indexName}`);
    } else {
      console.log(`   ❌ ${indexName} - MISSING!`);
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 MongoDB Index Creation Script\n');
  console.log(`📌 Database: ${DATABASE_URL}\n`);
  console.log('⚠️  WARNING: Index creation may take several minutes on large collections');
  console.log('⚠️  Indexes are created in the background but may impact performance\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    const allResults: IndexCreationResult[] = [];
    const totalStartTime = Date.now();

    // Create indexes for each collection
    for (const [collectionName, indexes] of Object.entries(ALL_INDEXES)) {
      if (indexes.length === 0) {
        console.log(`\n📂 Collection: ${collectionName}`);
        console.log(`   ⏭️  No indexes defined, skipping...`);
        continue;
      }

      const results = await createIndexesForCollection(collectionName, indexes);
      allResults.push(...results);

      // Verify indexes
      await verifyIndexes(collectionName, indexes);
    }

    const totalTimeTaken = Date.now() - totalStartTime;

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    const created = allResults.filter(r => r.status === 'created').length;
    const alreadyExists = allResults.filter(r => r.status === 'already_exists').length;
    const errors = allResults.filter(r => r.status === 'error').length;

    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Already Exists: ${alreadyExists}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`⏱️  Total Time: ${(totalTimeTaken / 1000).toFixed(2)}s`);

    if (errors > 0) {
      console.log('\n⚠️  ERRORS OCCURRED:');
      allResults
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   ❌ ${r.collection}.${r.indexName}: ${r.error}`);
        });
    }

    console.log('\n✅ Index creation script completed successfully');

    // Performance recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📈 NEXT STEPS');
    console.log('='.repeat(60));
    console.log('1. Run EXPLAIN ANALYZE on your slowest queries to verify index usage');
    console.log('2. Monitor query performance in production using MongoDB Atlas/Compass');
    console.log(
      '3. Review index usage after 1 week: db.collection.aggregate([{ $indexStats: {} }])',
    );
    console.log('4. Drop unused indexes to save disk space and write performance');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Execute script
main();
