import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env['DATABASE_URL'] || 'mongodb://localhost:27017/toofreshtowaste';

interface IndexEntry {
  name: string;
  key: Record<string, number | string>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

interface IndexUsage {
  name: string;
  accesses: number;
  since: Date | null;
}

interface RedundancyCandidate {
  index: string;
  reason: string;
  coveredBy: string;
  accesses: number;
}

interface CollectionReport {
  collection: string;
  docCount: number;
  indexCount: number;
  candidates: RedundancyCandidate[];
}

function keyToString(key: Record<string, number | string>): string {
  return Object.entries(key)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

function isPrefixOf(
  shorter: Record<string, number | string>,
  longer: Record<string, number | string>,
): boolean {
  const shorterKeys = Object.entries(shorter);
  const longerKeys = Object.entries(longer);

  if (shorterKeys.length >= longerKeys.length) return false;

  for (let i = 0; i < shorterKeys.length; i++) {
    const [sKey, sVal] = shorterKeys[i]!;
    const [lKey, lVal] = longerKeys[i]!;
    if (sKey !== lKey || String(sVal) !== String(lVal)) return false;
  }
  return true;
}

async function getIndexUsage(
  db: mongoose.mongo.Db,
  collectionName: string,
): Promise<Map<string, IndexUsage>> {
  const usageMap = new Map<string, IndexUsage>();
  try {
    const stats = await db
      .collection(collectionName)
      .aggregate([{ $indexStats: {} }])
      .toArray();

    for (const stat of stats) {
      const name = stat['name'] as string;
      const accesses = stat['accesses'] as Record<string, unknown> | undefined;
      usageMap.set(name, {
        name,
        accesses: (accesses?.['ops'] as number) ?? 0,
        since: (accesses?.['since'] as Date) ?? null,
      });
    }
  } catch {
    // $indexStats may not be available on all deployments
  }
  return usageMap;
}

async function main(): Promise<void> {
  console.log('=== MongoDB Index Audit ===');
  console.log('NOTE: This is a CANDIDATE REPORT. Do NOT auto-drop indexes.');
  console.log('Prefix matching alone cannot determine if an index is safe to remove.');
  console.log('Validate against real query patterns before dropping anything.\n');
  console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}\n`);

  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('Failed to get database reference');
  }

  const collections = await db.listCollections().toArray();
  const reports: CollectionReport[] = [];
  let totalIndexes = 0;

  for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = col.name;
    const docCount = await db.collection(name).countDocuments();
    const indexes = (await db.collection(name).indexes()) as IndexEntry[];
    const nonIdIndexes = indexes.filter(i => i.name !== '_id_');
    totalIndexes += indexes.length;

    const usageMap = await getIndexUsage(db, name);
    const candidates: RedundancyCandidate[] = [];

    // Check prefix coverage — skip unique/sparse/TTL indexes (they serve distinct purposes)
    for (const idx of nonIdIndexes) {
      if (idx.unique || idx.sparse || idx.expireAfterSeconds !== undefined) continue;

      for (const other of nonIdIndexes) {
        if (idx.name === other.name) continue;
        if (isPrefixOf(idx.key, other.key)) {
          const usage = usageMap.get(idx.name);
          candidates.push({
            index: `${idx.name} {${keyToString(idx.key)}}`,
            reason: 'prefix-covered',
            coveredBy: `${other.name} {${keyToString(other.key)}}`,
            accesses: usage?.accesses ?? -1,
          });
        }
      }
    }

    // Check exact duplicates (same key, different name)
    const seen = new Map<string, string>();
    for (const idx of nonIdIndexes) {
      const keyStr = keyToString(idx.key);
      const existing = seen.get(keyStr);
      if (existing) {
        const usage = usageMap.get(idx.name);
        candidates.push({
          index: `${idx.name} {${keyStr}}`,
          reason: 'duplicate-key',
          coveredBy: existing,
          accesses: usage?.accesses ?? -1,
        });
      } else {
        seen.set(keyStr, `${idx.name} {${keyStr}}`);
      }
    }

    if (candidates.length > 0 || (docCount === 0 && nonIdIndexes.length > 0)) {
      reports.push({ collection: name, docCount, indexCount: indexes.length, candidates });
    }
  }

  // Print report
  console.log('=== Candidate Redundancy Report ===\n');

  for (const r of reports) {
    console.log(`--- ${r.collection} (${r.docCount} docs, ${r.indexCount} indexes) ---`);
    if (r.candidates.length === 0) {
      console.log(`  (empty collection with ${r.indexCount - 1} non-_id indexes — consider if needed)`);
    }
    for (const c of r.candidates) {
      const accessStr = c.accesses >= 0 ? ` [${c.accesses} accesses]` : ' [usage unknown]';
      console.log(`  CANDIDATE: ${c.index}${accessStr}`);
      console.log(`    Reason: ${c.reason}`);
      console.log(`    Covered by: ${c.coveredBy}`);
      if (c.accesses > 0) {
        console.log(`    ⚠ ACTIVELY USED — verify query patterns before removing`);
      }
    }
    console.log('');
  }

  // Summary
  const totalCandidates = reports.reduce((sum, r) => sum + r.candidates.length, 0);
  console.log(`Total indexes: ${totalIndexes} across ${collections.length} collections`);
  console.log(`Candidates for review: ${totalCandidates}`);

  if (totalCandidates > 0) {
    console.log('\n=== Review Commands (DO NOT auto-apply) ===\n');
    for (const r of reports) {
      for (const c of r.candidates) {
        const idxName = c.index.split(' {')[0];
        console.log(`# ${c.reason}: ${c.index} -> covered by ${c.coveredBy}`);
        console.log(`# Verify first: db.${r.collection}.find({...}).explain("executionStats")`);
        console.log(`db.${r.collection}.dropIndex("${idxName}")`);
        console.log('');
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
