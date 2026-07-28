/**
 * =========================================
 * 🔤 HTML ENTITY DECODING MIGRATION
 * =========================================
 *
 * Purpose: Decode HTML entities (&amp; → &, etc.) in establishment names
 * and other text fields that were encoded by the sanitization middleware
 * before the decode-on-write fix was added.
 *
 * Usage:
 *   pnpm migration:decode-entities              # Dry run (preview changes)
 *   pnpm migration:decode-entities:execute      # Execute migration
 */

import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CONFIG = {
  dryRun: !process.argv.includes('--execute'),
};

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};

const ENTITY_REGEX = /&amp;|&lt;|&gt;|&quot;|&#x27;|&#39;/g;

function decode(str: string): string {
  return str.replace(ENTITY_REGEX, match => ENTITY_MAP[match] ?? match);
}

async function run(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log(`\n🔤 HTML Entity Decoding Migration (${CONFIG.dryRun ? 'DRY RUN' : 'EXECUTE'})\n`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  // Collections and fields to scan
  const targets = [
    { collection: 'establishments', fields: ['name', 'description'] },
    { collection: 'users', fields: ['firstName', 'lastName'] },
    { collection: 'offers', fields: ['title', 'description'] },
  ];

  let totalFixed = 0;

  for (const { collection, fields } of targets) {
    const col = db.collection(collection);

    // Build $or filter: any field containing an HTML entity
    const orConditions = fields.map(f => ({ [f]: { $regex: ENTITY_REGEX.source } }));
    const docs = await col.find({ $or: orConditions }).toArray();

    if (docs.length === 0) {
      console.log(`  ✅ ${collection}: no encoded entities found`);
      continue;
    }

    console.log(`  📝 ${collection}: ${docs.length} document(s) with HTML entities`);

    for (const doc of docs) {
      const updates: Record<string, string> = {};

      for (const field of fields) {
        const value = doc[field];
        if (typeof value === 'string' && ENTITY_REGEX.test(value)) {
          ENTITY_REGEX.lastIndex = 0;
          updates[field] = decode(value);
          console.log(`     ${doc._id} ${field}: "${value}" → "${updates[field]}"`);
        }
      }

      if (Object.keys(updates).length > 0) {
        if (!CONFIG.dryRun) {
          await col.updateOne({ _id: doc._id }, { $set: updates });
        }
        totalFixed++;
      }
    }
  }

  console.log(
    `\n${CONFIG.dryRun ? '🔍 Would fix' : '✅ Fixed'} ${totalFixed} document(s) total.\n`,
  );
  if (CONFIG.dryRun && totalFixed > 0) {
    console.log('  Run with --execute to apply changes.\n');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
