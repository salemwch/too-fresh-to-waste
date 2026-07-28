/**
 * Schema registry — the single source of truth for database indexes.
 *
 * Every index this application needs is declared on its Mongoose schema. In
 * production `autoIndex` is off (`app.module.ts`), so nothing creates those
 * indexes automatically; `create-indexes.ts` does it explicitly using this
 * registry, and `verify-indexes.ts` audits the live database against it.
 *
 * This file exists so neither script keeps its own hand-written list. A second
 * list is a list that drifts: the previous `ALL_INDEXES` constant covered 13 of
 * 58 collections, which is how ten TTL policies came to be declared in code but
 * absent from production.
 *
 * Discovery is by convention, verified by `check:ts` and the schema-export test:
 * every `*.schema.ts` file exports its schema as `<ModelName>Schema` built by
 * `SchemaFactory.createForClass`. The model name is the export name minus the
 * `Schema` suffix, which matches `MongooseModule.forFeature({ name: X.name })`
 * in the app modules.
 */

import * as fs from 'fs';
import * as path from 'path';
import mongoose, { type Connection, type Schema } from 'mongoose';

/** A schema discovered on disk and registered against a connection. */
export interface RegisteredModel {
  /** Mongoose model name, e.g. `PaymentWebhook`. */
  modelName: string;
  /** Physical collection name, e.g. `paymentwebhooks` or `sms_opt_out_records`. */
  collectionName: string;
  schema: Schema;
  /** Path relative to the backend package root, for error messages. */
  sourceFile: string;
}

const SCHEMA_SUFFIX = 'Schema';
const SCHEMA_FILE_SUFFIX = '.schema.ts';
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(PACKAGE_ROOT, 'src');

/** Recursively collect every `*.schema.ts` under `src/`. */
function findSchemaFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...findSchemaFiles(full));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(SCHEMA_FILE_SUFFIX)) {
      found.push(full);
    }
  }

  return found;
}

function isSchema(value: unknown): value is Schema {
  return value instanceof mongoose.Schema;
}

/**
 * Load every schema under `src/` and register it on `conn`.
 *
 * Registering (rather than reading `schema.indexes()` directly) is deliberate:
 * Mongoose derives the collection name from the model name and the schema's
 * `collection` option, so this reproduces exactly the collection the running
 * application talks to. Guessing a plural form here would reintroduce the drift
 * this registry removes.
 *
 * Sorted by collection name so script output is stable and diffable.
 */
export function registerAllModels(conn: Connection): RegisteredModel[] {
  const registered: RegisteredModel[] = [];
  const seen = new Map<string, string>();

  for (const file of findSchemaFiles(SRC_DIR)) {
    const sourceFile = path.relative(PACKAGE_ROOT, file);
    // A dynamic require is the point: the path is computed, so a static import
    // cannot express it. This is what makes the registry drift-proof — a new
    // schema file is picked up with no list to update. ts-node compiles the file
    // on demand; schema modules only define decorators, so requiring them has no
    // side effects beyond that.
    const moduleExports = require(file) as Record<string, unknown>;

    for (const [exportName, exported] of Object.entries(moduleExports)) {
      if (!isSchema(exported)) {
        continue;
      }

      if (!exportName.endsWith(SCHEMA_SUFFIX) || exportName === SCHEMA_SUFFIX) {
        throw new Error(
          `${sourceFile} exports a Mongoose schema as "${exportName}". ` +
            `Schema exports must be named "<ModelName>${SCHEMA_SUFFIX}" so the model ` +
            `name can be derived. Rename it, or the index scripts will skip it.`,
        );
      }

      const modelName = exportName.slice(0, -SCHEMA_SUFFIX.length);

      const previous = seen.get(modelName);
      if (previous !== undefined) {
        throw new Error(
          `Duplicate model name "${modelName}": declared in both ${previous} and ` +
            `${sourceFile}. Model names must be unique — Mongoose would otherwise ` +
            `map both onto one collection.`,
        );
      }
      seen.set(modelName, sourceFile);

      /*
       * Registering a model on a live connection normally makes Mongoose build
       * that model's indexes in the background. That is wrong for every consumer
       * of this registry: `verify-indexes.ts` is an audit and must not write, and
       * it would silently repair the drift it is meant to report — which it did,
       * hiding a deliberately dropped index during testing. `create-indexes.ts`
       * calls `createIndexes()` explicitly, so it loses nothing.
       *
       * Set per schema rather than via connection options, because a schema-level
       * value would otherwise win.
       */
      exported.set('autoIndex', false);
      exported.set('autoCreate', false);

      const model = conn.model(modelName, exported);

      registered.push({
        modelName,
        collectionName: model.collection.name,
        schema: exported,
        sourceFile,
      });
    }
  }

  if (registered.length === 0) {
    throw new Error(
      `No schemas found under ${SRC_DIR}. Expected files matching *${SCHEMA_FILE_SUFFIX}.`,
    );
  }

  return registered.sort((a, b) => a.collectionName.localeCompare(b.collectionName));
}

/** Read the connection string the way every db script does, so they cannot disagree. */
export function resolveDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];

  if (url === undefined || url.trim() === '') {
    throw new Error(
      'DATABASE_URL is not set. Refusing to guess a connection string: an index ' +
        'script pointed at the wrong database is worse than one that does not run.',
    );
  }

  return url;
}

/** Hide credentials before printing a connection string to a log. */
export function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@]+@/, '//***@');
}
