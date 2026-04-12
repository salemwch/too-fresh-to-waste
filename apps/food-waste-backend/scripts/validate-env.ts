/**
 * Standalone environment variable validation script.
 *
 * Runs the same Joi schema used at app startup — WITHOUT booting NestJS.
 * Use this in CI before deploying to catch missing/invalid vars early.
 *
 * Usage:
 *   ts-node -r tsconfig-paths/register scripts/validate-env.ts [envFile]
 *
 * Examples:
 *   ts-node -r tsconfig-paths/register scripts/validate-env.ts              # validates .env
 *   ts-node -r tsconfig-paths/register scripts/validate-env.ts .env.staging # validates .env.staging
 *
 * Exit code 0 = all vars valid | Exit code 1 = validation failed
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { envValidationSchema } from '../src/config/env.validation';

const envFile = process.argv[2] ?? '.env';
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`\n[validate-env] ERROR: File not found: ${envPath}\n`);
  process.exit(1);
}

const parsed = dotenv.config({ path: envPath });
if (parsed.error) {
  console.error(`\n[validate-env] ERROR: Failed to parse ${envFile}:`, parsed.error.message);
  process.exit(1);
}

console.log(`\n[validate-env] Validating ${envFile} (NODE_ENV=${process.env['NODE_ENV'] ?? 'development'})...\n`);

const { error, value } = envValidationSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
});

if (error) {
  console.error('[validate-env] FAILED — missing or invalid environment variables:\n');
  error.details.forEach((detail, i) => {
    console.error(`  ${i + 1}. ${detail.message}`);
  });
  console.error(`\n  Total issues: ${error.details.length}`);
  console.error('\n  Fix these before deploying.\n');
  process.exit(1);
}

const requiredKeys = Object.keys(value).filter(
  (k) => !['NODE_ENV', 'PORT'].includes(k),
);
console.log(`[validate-env] OK — ${requiredKeys.length} variables validated successfully.\n`);
process.exit(0);
