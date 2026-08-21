const base = require('./jest.config');

/**
 * Integration suites that execute against a real MongoDB replica set.
 *
 * They live behind their own config for one reason: the default `jest.config.js`
 * ignores `*.integration.spec.ts`, so `pnpm test` stays runnable on a machine
 * with no database. That split is only safe because this config *requires* the
 * database rather than skipping when it is absent — a suite that quietly skips
 * reports green while proving nothing.
 *
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */
module.exports = {
  ...base,
  displayName: 'backend:integration',
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.integration.spec.ts'],
  // Real aggregations over a real replica set; the unit-suite 10s is too tight.
  testTimeout: 60_000,
  coverageThreshold: undefined,
};
