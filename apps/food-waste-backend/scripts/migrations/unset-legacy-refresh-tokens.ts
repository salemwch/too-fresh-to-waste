/**
 * =========================================
 * 🔐 REMOVE PLAINTEXT REFRESH TOKENS
 * =========================================
 *
 * Purpose: `$unset` the legacy `users.refreshTokens` array, which stored
 * refresh tokens in **plaintext**.
 *
 * Why it is safe. The field had no readers. Authentication runs entirely
 * against the `refreshtokens` collection, which stores a SHA-256 hash of the
 * token (`auth/services/token.service.ts`) alongside rotation, token-family
 * theft detection and TTL expiry. The array was written on login and logout and
 * consulted by nothing — every clearing site already performed the real
 * revocation (`revokeAllUserTokens` + `incrementTokenRevocationVersion`) and
 * was annotated "Backward compatibility". Dropping it removes writes, not a
 * control, so no session is affected.
 *
 * Why it matters anyway. A raw token from that array is still a working
 * credential: validation hashes whatever is presented and looks the hash up. So
 * anyone with a database dump — a backup, an analytics copy, a support export —
 * held live bearer tokens for as long as they had not expired, in exchange for
 * no functionality at all.
 *
 * Removing the property from the schema stops new writes. It does **not** touch
 * documents already stored: Mongoose only omits the key going forward, and with
 * `strict` mode the old value simply becomes invisible to the application while
 * remaining on disk. That is the worst outcome — a plaintext secret nobody can
 * see and nobody remembers to delete. Hence this migration.
 *
 * Usage:
 *   pnpm migration:unset-refresh-tokens            # Dry run (preview)
 *   pnpm migration:unset-refresh-tokens:execute    # Execute
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import * as mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'users';
const FIELD = 'refreshTokens';

const dryRun = !process.argv.includes('--execute');

const log = (msg: string): void => {
  console.log(msg);
};

async function run(): Promise<void> {
  const uri = process.env['DATABASE_URL'];
  if (!uri) {
    throw new Error('DATABASE_URL is not set. Configure .env before running this migration.');
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('No database handle after connecting.');
  }
  const collection = db.collection(COLLECTION);

  const total = await collection.countDocuments();

  // Any document still carrying the key, whether or not the array has entries.
  // An empty array holds no secret but still needs removing, otherwise the
  // field lingers and a future reader may resurrect it.
  const filter = { [FIELD]: { $exists: true } };
  const affected = await collection.countDocuments(filter);

  // The count that actually represents exposure.
  const withLiveTokens = await collection.countDocuments({
    [FIELD]: { $exists: true, $ne: [] },
  });

  log(`Collection ${COLLECTION}: ${total} user(s) total.`);
  log(`Carrying "${FIELD}":  ${affected}`);
  log(`…of which hold at least one plaintext token: ${withLiveTokens}`);

  if (affected === 0) {
    log('');
    log('No user carries the legacy field. Nothing to do.');
    return;
  }

  if (dryRun) {
    log('');
    log('DRY RUN — would perform:');
    log(`  db.${COLLECTION}.updateMany(${JSON.stringify(filter)}, { $unset: { ${FIELD}: "" } })`);
    log('');
    log('No token values are printed, by design — they are live credentials');
    log('until they expire, and this script must not copy them into a terminal');
    log('scrollback or a CI log.');
    log('');
    log('Re-run with --execute to apply.');
    return;
  }

  log('');
  log(`Unsetting "${FIELD}" on ${affected} user(s)…`);

  const result = await collection.updateMany(filter, { $unset: { [FIELD]: '' } });

  log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  const remaining = await collection.countDocuments(filter);
  if (remaining > 0) {
    // Concurrent writes cannot reintroduce it — the schema no longer declares
    // the field, so Mongoose strips it — but verify rather than assume.
    throw new Error(`${remaining} user(s) still carry "${FIELD}" after the update.`);
  }

  log('');
  log(`Done. No user document contains "${FIELD}" any more.`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    await mongoose.disconnect();
    process.exit(1);
  });
