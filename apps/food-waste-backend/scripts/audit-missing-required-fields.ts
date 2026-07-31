/**
 * =========================================
 * 🔍 MISSING REQUIRED FIELDS AUDIT
 * =========================================
 *
 * Purpose: find documents that are missing a field their schema declares
 * `required`. Read-only — it reports, it never writes.
 *
 * Why this exists: `seasonBagTarget` is `@Prop({ required: true })` on
 * VotingCycle with no `default`. `required` is a *write* validator; it says
 * nothing about documents already in the collection, and with no default there
 * is nothing for Mongoose to backfill on read. So a cycle written before that
 * field existed comes back without the key, and the admin voting page called
 * `.toLocaleString()` on it and unmounted the whole route. Seven Sentry events,
 * and nobody could open the page.
 *
 * A static sweep of the source finds 272 such props across 58 schemas, which is
 * far too many to act on and mostly harmless — a field that has always been
 * written is fine no matter how it is declared. Only the database can say which
 * ones are actually absent, so this asks it.
 *
 * Reads nothing but counts: `countDocuments({ field: { $exists: false } })` per
 * candidate path, which is served from an index where one exists and is a
 * collection scan where it does not. Run it against a replica if the cluster is
 * busy.
 *
 * Usage:
 *   pnpm audit:missing-required                    # every collection
 *   pnpm audit:missing-required -- --model=VotingCycle
 */

import * as mongoose from 'mongoose';

import {
  redactDatabaseUrl,
  registerAllModels,
  resolveDatabaseUrl,
  type RegisteredModel,
} from './lib/schema-registry';

interface Finding {
  modelName: string;
  collectionName: string;
  field: string;
  missing: number;
  total: number;
}

/**
 * Paths a document can legitimately lack even when the schema calls them
 * required.
 *
 * `_id` is Mongo's own. Discriminator keys are absent on the base type. Nested
 * paths under an array (`a.b`) describe each element, not the parent document,
 * so `$exists: false` on them counts documents with an empty array — noise, not
 * a defect.
 */
function isAuditable(path: string): boolean {
  return path !== '_id' && path !== '__v' && !path.includes('.');
}

/** Required paths with no default — the ones nothing backfills on read. */
function candidatePaths(model: RegisteredModel): string[] {
  const paths: string[] = [];

  model.schema.eachPath((name, type) => {
    if (!isAuditable(name)) {
      return;
    }

    const options = (type as { options?: Record<string, unknown> }).options ?? {};
    const required = options['required'] === true;
    const hasDefault = options['default'] !== undefined;

    if (required && !hasDefault) {
      paths.push(name);
    }
  });

  return paths;
}

async function run(): Promise<void> {
  const uri = resolveDatabaseUrl();
  console.log(`Connecting to ${redactDatabaseUrl(uri)}\n`);

  const conn = await mongoose.createConnection(uri).asPromise();
  const models = registerAllModels(conn);

  const onlyArg = process.argv.find(a => a.startsWith('--model='));
  const only = onlyArg?.split('=')[1];
  const targets = only ? models.filter(m => m.modelName === only) : models;

  if (only && targets.length === 0) {
    throw new Error(`No registered model named "${only}".`);
  }

  const findings: Finding[] = [];
  let scannedFields = 0;

  for (const model of targets) {
    const fields = candidatePaths(model);
    if (fields.length === 0) {
      continue;
    }

    const collection = conn.collection(model.collectionName);
    const total = await collection.countDocuments();
    // An empty collection cannot be inconsistent, and skipping it saves a query
    // per candidate field across dozens of unused collections.
    if (total === 0) {
      continue;
    }

    for (const field of fields) {
      scannedFields++;
      const missing = await collection.countDocuments({ [field]: { $exists: false } });
      if (missing > 0) {
        findings.push({
          modelName: model.modelName,
          collectionName: model.collectionName,
          field,
          missing,
          total,
        });
      }
    }
  }

  console.log(
    `Checked ${scannedFields} required-without-default fields across ${targets.length} models.\n`,
  );

  if (findings.length === 0) {
    console.log('No documents are missing a required field. Nothing to migrate.');
    await conn.close();
    return;
  }

  // Worst first: a field missing on most of its collection is the one a UI is
  // most likely to hit.
  findings.sort((a, b) => b.missing / b.total - a.missing / a.total);

  console.log(`${findings.length} field(s) absent on at least one document:\n`);
  for (const f of findings) {
    const pct = ((f.missing / f.total) * 100).toFixed(1);
    const label = `  ${f.modelName}.${f.field}`.padEnd(52);
    console.log(`${label}${f.missing}/${f.total} documents (${pct}%)  [${f.collectionName}]`);
  }

  console.log('');
  console.log('Each of these is a crash waiting for a UI that reads it without a guard.');
  console.log('Fix by backfilling the field, or by giving the @Prop a default and');
  console.log('backfilling — a default alone does not touch documents already written.');

  await conn.close();
  // Deliberately not a non-zero exit: this is a report, and a stale document is
  // not a reason to fail a pipeline that did not introduce it.
}

run().catch((err: unknown) => {
  console.error('Audit failed:', err);
  process.exitCode = 1;
});
