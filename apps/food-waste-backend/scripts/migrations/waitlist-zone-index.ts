/**
 * Merge the two waiting lists into one collection.
 *
 * The global launch list was unique on `email` alone, which makes a per-city
 * list impossible: one address could never appear twice, and waiting for two
 * cities is the ordinary case. The schema now declares
 * `{ email: 1, zone: 1 }` unique instead — MongoDB indexes a missing `zone` as
 * null, so the global list still admits each address exactly once.
 *
 * Changing an index in a schema does not change it in the database. This drops
 * the old one and builds the new pair, and is safe to run more than once.
 *
 *   pnpm --filter @foodwaste/backend migrate:waitlist-zone
 *   pnpm --filter @foodwaste/backend migrate:waitlist-zone --apply
 *
 * Without `--apply` it reports what it would do and changes nothing.
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

import { redactDatabaseUrl, resolveDatabaseUrl } from '../lib/schema-registry';

dotenv.config();

const COLLECTION = 'waitlistentries';
const OLD_INDEX = 'email_1';

const NEW_INDEXES = [
  { name: 'uniq_email_zone', key: { email: 1, zone: 1 }, unique: true },
  { name: 'zone', key: { zone: 1 }, unique: false },
] as const;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = resolveDatabaseUrl();

  console.log(`\nwaitlist zone index migration — ${redactDatabaseUrl(url)}`);
  console.log(apply ? 'mode: APPLY\n' : 'mode: dry run (pass --apply to make changes)\n');

  const connection = await mongoose.createConnection(url).asPromise();

  try {
    const collections = await connection.db!.listCollections({ name: COLLECTION }).toArray();
    if (collections.length === 0) {
      console.log(`${COLLECTION} does not exist yet — the schema will build both`);
      console.log('indexes on first write. Nothing to migrate.\n');
      return;
    }

    const collection = connection.db!.collection(COLLECTION);
    const existing = await collection.indexes();
    const names = new Set(existing.map(index => index.name));

    // A row with no zone is a global-list entry. Reported because the unique
    // constraint changes meaning for exactly those rows.
    const [total, scoped] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ zone: { $exists: true, $ne: null } }),
    ]);
    console.log(`rows: ${total} total, ${scoped} already carry a city, ${total - scoped} global\n`);

    if (names.has(OLD_INDEX)) {
      console.log(`DROP    ${OLD_INDEX}  (unique on email alone)`);
      if (apply) await collection.dropIndex(OLD_INDEX);
    } else {
      console.log(`skip    ${OLD_INDEX} — already gone`);
    }

    for (const index of NEW_INDEXES) {
      if (names.has(index.name)) {
        console.log(`skip    ${index.name} — already present`);
        continue;
      }
      console.log(`CREATE  ${index.name}  ${JSON.stringify(index.key)}`);
      if (apply) {
        await collection.createIndex(index.key, {
          name: index.name,
          ...(index.unique ? { unique: true } : {}),
        });
      }
    }

    console.log(apply ? '\nDone.\n' : '\nDry run — nothing was changed.\n');
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
