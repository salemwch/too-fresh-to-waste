/**
 * Create every index declared on a Mongoose schema.
 *
 * Production runs with `autoIndex: false` (`app.module.ts`), so Mongoose never
 * creates indexes there. This script is what does, and it must be run before or
 * immediately after any deploy that adds an index.
 *
 * Indexes come from the schemas themselves via `scripts/lib/schema-registry.ts`.
 * There is deliberately no hand-written list here: the previous `ALL_INDEXES`
 * constant covered 13 of 58 collections and indexed four fields that no longer
 * existed, which is how ten TTL policies came to be declared in code and absent
 * from production.
 *
 * This script only ever ADDS. `Model.createIndexes()` creates what is missing and
 * leaves everything else alone; it never drops. Removing an index is a separate,
 * deliberate act — run `pnpm verify:indexes` to see what is extra and
 * `pnpm db:audit-indexes` to check real usage before dropping anything.
 *
 * Usage:
 *   DATABASE_URL="mongodb://..." pnpm ts-node scripts/create-indexes.ts
 *   pnpm db:create-indexes
 *
 * Operational notes:
 * - Run during low-traffic periods. Index builds on a large collection compete
 *   with live traffic for IO.
 * - Watch progress:
 *   db.currentOp({ "command.createIndexes": { $exists: true } })
 * - A collection with 1M+ documents can take tens of minutes per index.
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { redactDatabaseUrl, registerAllModels, resolveDatabaseUrl } from './lib/schema-registry';

dotenv.config();

interface CollectionResult {
  collectionName: string;
  declared: number;
  createdOrExisting: number;
  error?: string;
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();

  console.log('MongoDB index creation');
  console.log(`Database: ${redactDatabaseUrl(databaseUrl)}`);
  console.log('Mode: additive — indexes are created, never dropped.\n');

  const conn = await mongoose.createConnection(databaseUrl).asPromise();

  try {
    const models = registerAllModels(conn);
    console.log(`Discovered ${models.length} schemas.\n`);

    const results: CollectionResult[] = [];

    for (const { modelName, collectionName, schema } of models) {
      const declared = schema.indexes().length;

      if (declared === 0) {
        // Not a problem in itself — a collection queried only by _id needs no
        // index. Reported so it is a visible choice rather than an oversight.
        console.log(`  ${collectionName}: no indexes declared, skipping`);
        results.push({ collectionName, declared: 0, createdOrExisting: 0 });
        continue;
      }

      const model = conn.model(modelName);

      try {
        // Creates missing indexes; existing ones are a no-op. Throws on a
        // conflict, e.g. the same key pattern already present under another name.
        await model.createIndexes();

        const live = await model.collection.indexes();
        // -1 for the implicit _id index, which no schema declares.
        const liveNonId = live.length - 1;

        console.log(`  ${collectionName}: ${declared} declared, ${liveNonId} live`);
        results.push({ collectionName, declared, createdOrExisting: liveNonId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ${collectionName}: FAILED — ${message}`);
        results.push({
          collectionName,
          declared,
          createdOrExisting: 0,
          error: message,
        });
      }
    }

    const failed = results.filter(r => r.error !== undefined);
    const totalDeclared = results.reduce((sum, r) => sum + r.declared, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Collections processed: ${results.length}`);
    console.log(`Indexes declared:      ${totalDeclared}`);
    console.log(`Collections failed:    ${failed.length}`);
    console.log('='.repeat(60));

    if (failed.length > 0) {
      console.error('\nFailures:');
      for (const f of failed) {
        console.error(`  ${f.collectionName}: ${f.error}`);
      }
      console.error(
        '\nA common cause is an index whose key pattern already exists under a ' +
          'different name. MongoDB rejects that. Either reuse the existing name in ' +
          'the schema, or drop the old index deliberately.',
      );
      process.exitCode = 1;
      return;
    }

    console.log('\nAll declared indexes exist. Run `pnpm verify:indexes` to audit for drift.');
  } finally {
    await conn.close();
  }
}

main().catch((error: unknown) => {
  console.error('Index creation failed:', error);
  process.exit(1);
});
