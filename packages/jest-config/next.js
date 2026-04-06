/**
 * Next.js Jest config — uses next/jest transformer, jsdom environment.
 *
 * Usage in apps/web/jest.config.js:
 *   const nextJest = require('next/jest');
 *   const base = require('@foodwaste/jest-config/next');
 *   const createJestConfig = nextJest({ dir: './' });
 *   module.exports = createJestConfig({ ...base, ... });
 */
'use strict';

const base = require('./base');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/app/**/layout.tsx', // layouts are wiring, low test value
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@foodwaste/shared$': '<rootDir>/../../packages/shared/src',
    '^@foodwaste/ui$': '<rootDir>/../../packages/ui/src',
  },
};
