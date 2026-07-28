/**
 * Audit the live database against the indexes declared on the Mongoose schemas.
 *
 * Reports three kinds of drift per collection:
 *   MISSING     declared on a schema, absent from the database. In production this
 *               is the default state for any newly added index, because
 *               `autoIndex` is off there — fix by running `pnpm db:create-indexes`.
 *   EXTRA       present in the database, declared nowhere. Either a deliberate
 *               hand-made index or a leftover. Never auto-dropped.
 *   MISMATCHED  same key pattern, different options — a changed TTL window, a
 *               uniqueness constraint added or removed. These are the dangerous
 *               ones: the index exists, so nothing looks broken, but it no longer
 *               does what the schema says.
 *
 * This replaces a version that asserted index *counts* per collection
 * (`users: 18`). A count passes with eighteen wrong indexes, and it could not
 * detect that ten TTL policies declared in code had never been created in
 * production — which is exactly what had happened.
 *
 * Usage:
 *   pnpm verify:indexes            # report, exit 0
 *   pnpm verify:indexes --strict   # exit 1 on MISSING or MISMATCHED (for CI)
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { redactDatabaseUrl, registerAllModels, resolveDatabaseUrl } from './lib/schema-registry';

dotenv.config();

/** Options that change what an index does. Anything else is cosmetic. */
interface SignificantOptions {
  unique: boolean;
  sparse: boolean;
  expireAfterSeconds: number | undefined;
  partialFilterExpression: string | undefined;
}

interface Drift {
  kind: 'MISSING' | 'EXTRA' | 'MISMATCHED';
  detail: string;
}

type IndexKey = Record<string, number | string>;

/** Canonical string for a key pattern. Field order is significant and preserved. */
function canonicalKey(key: IndexKey): string {
  return Object.entries(key)
    .map(([field, value]) => `${field}:${value}`)
    .join(',');
}

function significantOptions(source: Record<string, unknown>): SignificantOptions {
  const partial = source['partialFilterExpression'];

  return {
    unique: source['unique'] === true,
    sparse: source['sparse'] === true,
    expireAfterSeconds:
      typeof source['expireAfterSeconds'] === 'number' ? source['expireAfterSeconds'] : undefined,
    partialFilterExpression:
      partial === undefined || partial === null ? undefined : JSON.stringify(partial),
  };
}

function describeOptions(o: SignificantOptions): string {
  const parts: string[] = [];
  if (o.unique) {
    parts.push('unique');
  }
  if (o.sparse) {
    parts.push('sparse');
  }
  if (o.expireAfterSeconds !== undefined) {
    parts.push(`ttl=${o.expireAfterSeconds}s`);
  }
  if (o.partialFilterExpression !== undefined) {
    parts.push(`partial=${o.partialFilterExpression}`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

function optionsDiffer(a: SignificantOptions, b: SignificantOptions): boolean {
  return (
    a.unique !== b.unique ||
    a.sparse !== b.sparse ||
    a.expireAfterSeconds !== b.expireAfterSeconds ||
    a.partialFilterExpression !== b.partialFilterExpression
  );
}

/**
 * A text index cannot be compared by key pattern: MongoDB stores it as
 * `{ _fts: 'text', _ftsx: 1 }` regardless of which fields were indexed, and a
 * collection may hold only one. Matching by "is a text index" is therefore both
 * necessary and sufficient.
 */
function isTextIndex(key: IndexKey): boolean {
  return Object.values(key).includes('text') || '_fts' in key;
}

interface LiveIndex {
  name: string;
  key: IndexKey;
  options: SignificantOptions;
  matched: boolean;
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const strict = process.argv.includes('--strict');

  console.log('Index drift audit — schema declarations vs live database');
  console.log(`Database: ${redactDatabaseUrl(databaseUrl)}`);
  console.log(`Mode: ${strict ? 'strict (fails on MISSING/MISMATCHED)' : 'report only'}\n`);

  const conn = await mongoose.createConnection(databaseUrl).asPromise();

  try {
    const db = conn.db;
    if (db === undefined) {
      throw new Error(
        'Connected but no database handle — check the database name in DATABASE_URL.',
      );
    }

    const models = registerAllModels(conn);
    const existingCollections = new Set((await db.listCollections().toArray()).map(c => c.name));

    const driftByCollection = new Map<string, Drift[]>();
    let totalDeclared = 0;
    let missing = 0;
    let extra = 0;
    let mismatched = 0;
    const absentCollections: string[] = [];

    for (const { collectionName, schema, sourceFile } of models) {
      const declared = schema.indexes();
      totalDeclared += declared.length;

      if (!existingCollections.has(collectionName)) {
        // No documents have ever been written. Indexes will be created on first
        // write or by create-indexes; not drift.
        if (declared.length > 0) {
          absentCollections.push(collectionName);
        }
        continue;
      }

      const live: LiveIndex[] = (await db.collection(collectionName).indexes())
        .filter(idx => idx.name !== '_id_')
        .map(idx => ({
          name: String(idx.name),
          key: idx.key as IndexKey,
          options: significantOptions(idx as unknown as Record<string, unknown>),
          matched: false,
        }));

      const drift: Drift[] = [];

      for (const [fields, rawOptions] of declared) {
        const key = fields as IndexKey;
        const wanted = significantOptions((rawOptions ?? {}) as Record<string, unknown>);
        const wantedText = isTextIndex(key);

        const found = live.find(
          l =>
            !l.matched &&
            (wantedText ? isTextIndex(l.key) : canonicalKey(l.key) === canonicalKey(key)),
        );

        if (found === undefined) {
          drift.push({
            kind: 'MISSING',
            detail: `{${canonicalKey(key)}} [${describeOptions(wanted)}]  — declared in ${sourceFile}`,
          });
          missing++;
          continue;
        }

        found.matched = true;

        if (optionsDiffer(wanted, found.options)) {
          drift.push({
            kind: 'MISMATCHED',
            detail:
              `${found.name} {${canonicalKey(found.key)}}\n` +
              `      schema says: ${describeOptions(wanted)}\n` +
              `      database has: ${describeOptions(found.options)}`,
          });
          mismatched++;
        }
      }

      for (const l of live) {
        if (l.matched) {
          continue;
        }
        drift.push({
          kind: 'EXTRA',
          detail: `${l.name} {${canonicalKey(l.key)}} [${describeOptions(l.options)}]`,
        });
        extra++;
      }

      if (drift.length > 0) {
        driftByCollection.set(collectionName, drift);
      }
    }

    for (const [collectionName, drift] of [...driftByCollection].sort()) {
      console.log(`--- ${collectionName} ---`);
      for (const kind of ['MISSING', 'MISMATCHED', 'EXTRA'] as const) {
        for (const d of drift.filter(x => x.kind === kind)) {
          console.log(`  ${kind}: ${d.detail}`);
        }
      }
      console.log('');
    }

    if (absentCollections.length > 0) {
      console.log(
        `Collections not yet created (no drift, indexes build on first write): ${absentCollections.join(', ')}\n`,
      );
    }

    console.log('='.repeat(60));
    console.log(`Schemas:            ${models.length}`);
    console.log(`Indexes declared:   ${totalDeclared}`);
    console.log(`MISSING:            ${missing}`);
    console.log(`MISMATCHED:         ${mismatched}`);
    console.log(`EXTRA:              ${extra}`);
    console.log('='.repeat(60));

    if (missing > 0 || mismatched > 0) {
      console.log('\nTo create missing indexes: pnpm db:create-indexes');
    }
    if (extra > 0) {
      console.log(
        'EXTRA indexes are never dropped automatically. Check real usage first:\n' +
          '  pnpm db:audit-indexes   (reads $indexStats)',
      );
    }

    if (strict && (missing > 0 || mismatched > 0)) {
      process.exitCode = 1;
      return;
    }

    if (missing === 0 && mismatched === 0 && extra === 0) {
      console.log('\nNo drift. Database matches the schemas.');
    }
  } finally {
    await conn.close();
  }
}

main().catch((error: unknown) => {
  console.error('Index audit failed:', error);
  process.exit(1);
});
