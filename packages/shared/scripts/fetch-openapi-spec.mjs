#!/usr/bin/env node
/**
 * Fetch OpenAPI Spec from Running Backend
 *
 * Downloads the OpenAPI/Swagger JSON spec from the backend server
 * and saves it to openapi.json for type generation via openapi-typescript.
 *
 * Usage:
 *   node scripts/fetch-openapi-spec.mjs
 *   node scripts/fetch-openapi-spec.mjs --url=http://localhost:3000
 *
 * Prerequisites: Backend must be running (`pnpm --filter @foodwaste/backend dev`).
 *
 * @see https://docs.nestjs.com/openapi/introduction
 * @see https://openapi-ts.dev/
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const SPEC_ENDPOINT = '/api/v1/api-docs-json';
const OUTPUT_FILE = 'openapi.json';
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchSpec() {
  const urlArg = process.argv.find((arg) => arg.startsWith('--url='));
  const baseUrl = urlArg ? urlArg.split('=')[1] : DEFAULT_BACKEND_URL;
  const specUrl = `${baseUrl}${SPEC_ENDPOINT}`;

  console.log(`[openapi] Fetching spec from: ${specUrl}`);

  let response;
  try {
    response = await fetch(specUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.error(`[openapi] Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    } else {
      console.error(`[openapi] Cannot reach backend at ${baseUrl}`);
      console.error(
        `[openapi] Make sure the backend is running: pnpm --filter @foodwaste/backend dev`,
      );
    }
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`[openapi] HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const spec = await response.json();

  // Validate OpenAPI structure
  if (!spec.openapi && !spec.swagger) {
    console.error('[openapi] Response is not a valid OpenAPI/Swagger spec');
    process.exit(1);
  }

  const outputPath = resolve(__dirname, '..', OUTPUT_FILE);
  writeFileSync(outputPath, JSON.stringify(spec, null, 2) + '\n');

  const pathCount = Object.keys(spec.paths || {}).length;
  const schemaCount = Object.keys(spec.components?.schemas || {}).length;

  console.log('[openapi] Spec saved successfully');
  console.log(`[openapi]   File:     ${OUTPUT_FILE}`);
  console.log(`[openapi]   Version:  ${spec.info?.version ?? 'unknown'}`);
  console.log(`[openapi]   Title:    ${spec.info?.title ?? 'unknown'}`);
  console.log(`[openapi]   Paths:    ${pathCount}`);
  console.log(`[openapi]   Schemas:  ${schemaCount}`);
}

fetchSpec();
