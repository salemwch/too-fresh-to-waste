import mongoose from 'mongoose';
import { UserSchema } from '../src/users/schemas/user.schema';
import { OrderSchema } from '../src/orders/schemas/order.schema';
import { EstablishmentSchema } from '../src/establishments/schemas/establishment.schema';
import { OfferSchema } from '../src/offers/schemas/offer.schema';
import { RefreshTokenSchema } from '../src/auth/schemas/refresh-token.schema';
import { ReviewSchema } from '../src/reviews/schemas/review.schema';
import { FavoriteSchema } from '../src/favorites/schemas/favorite.schema';

/**
 * MongoDB Index Verification Script
 *
 * Validates that all enterprise-grade indexes are properly created
 * Run after deployment to ensure database performance optimization
 *
 * Usage:
 *   npm run verify:indexes
 *   or
 *   npx ts-node scripts/verify-indexes.ts
 */

interface IndexInfo {
  name: string;
  key: Record<string, number | string>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  '2dsphere'?: string;
}

interface SchemaIndexCount {
  schema: string;
  expectedMin: number;
  actual: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  indexes: IndexInfo[];
}

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/foodwaste';

// Expected minimum index counts per schema
const EXPECTED_INDEXES = {
  users: 18, // Base + Enterprise enhancements
  orders: 20, // Base + Enterprise enhancements
  establishments: 18, // Base + Enterprise enhancements
  offers: 23, // Base + Enterprise enhancements
  refreshtokens: 6, // Token security indexes
  reviews: 10, // Review indexes
  favorites: 5, // Favorite indexes
};

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${mongoose.connection.db.databaseName}\n`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function verifySchemaIndexes(
  collectionName: string,
  expectedMin: number,
): Promise<SchemaIndexCount> {
  const collection = mongoose.connection.db.collection(collectionName);
  const indexes = await collection.indexes();

  const status =
    indexes.length >= expectedMin
      ? 'PASS'
      : indexes.length >= expectedMin * 0.8
        ? 'WARNING'
        : 'FAIL';

  return {
    schema: collectionName,
    expectedMin,
    actual: indexes.length,
    status,
    indexes: indexes as IndexInfo[],
  };
}

function printIndexDetails(result: SchemaIndexCount): void {
  const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';

  console.log(`${statusIcon} ${result.schema.toUpperCase()}`);
  console.log(
    `   Expected: ≥${result.expectedMin} | Actual: ${result.actual} | Status: ${result.status}`,
  );

  if (result.status === 'FAIL') {
    console.log(`   ⚠️  MISSING ${result.expectedMin - result.actual} INDEXES!`);
  }

  console.log('   Indexes:');
  result.indexes.forEach((index, i) => {
    const keyStr = Object.entries(index.key)
      .map(([k, v]) => {
        if (v === 1) return k;
        if (v === -1) return `${k}↓`;
        if (v === '2dsphere') return `${k}(geo)`;
        if (v === 'text') return `${k}(text)`;
        return `${k}(${v})`;
      })
      .join(', ');

    const flags = [];
    if (index.unique) flags.push('unique');
    if (index.sparse) flags.push('sparse');
    if (index.expireAfterSeconds !== undefined) flags.push(`ttl:${index.expireAfterSeconds}s`);

    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    console.log(`   ${i + 1}. ${keyStr}${flagStr}`);
  });
  console.log('');
}

function printSummary(results: SchemaIndexCount[]): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const totalExpected = results.reduce((sum, r) => sum + r.expectedMin, 0);
  const totalActual = results.reduce((sum, r) => sum + r.actual, 0);
  const passed = results.filter(r => r.status === 'PASS').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`Total Schemas Checked: ${results.length}`);
  console.log(`Total Indexes Expected: ≥${totalExpected}`);
  console.log(`Total Indexes Found: ${totalActual}`);
  console.log('');
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('Some indexes are missing. This may impact performance.');
    console.log('To rebuild indexes:');
    console.log('  1. Restart the application (indexes auto-create)');
    console.log('  2. Or run: npm run build && npm start');
    console.log('  3. Or manually create via MongoDB shell');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  NOTICE:');
    console.log('Some schemas have fewer indexes than expected.');
    console.log('Monitor query performance and add indexes if needed.');
    process.exit(0);
  } else {
    console.log('\n🎉 All indexes verified successfully!');
    console.log('Database is optimized for production workloads.');
    process.exit(0);
  }
}

async function verifyIndexes(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         MONGODB INDEX VERIFICATION TOOL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Checking enterprise-grade indexes across all schemas...\n');

  const results: SchemaIndexCount[] = [];

  // Verify each schema
  for (const [collectionName, expectedMin] of Object.entries(EXPECTED_INDEXES)) {
    const result = await verifySchemaIndexes(collectionName, expectedMin);
    results.push(result);
    printIndexDetails(result);
  }

  printSummary(results);
}

async function main(): Promise<void> {
  try {
    await connectDatabase();
    await verifyIndexes();
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { verifyIndexes, verifySchemaIndexes };
