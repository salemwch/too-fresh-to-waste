/**
 * NestJS Jest config — ts-jest with decorator support, Node environment.
 *
 * Usage in apps/food-waste-backend/jest.config.js:
 *   const base = require('@foodwaste/jest-config/nestjs');
 *   module.exports = { ...base, displayName: 'backend', roots: ['<rootDir>/src'] };
 */
'use strict';

const base = require('./base');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testEnvironment: 'node',
  preset: 'ts-jest',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          resolveJsonModule: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  /*
   * ESM packages that must be transpiled before Jest can load them.
   *
   * Node 24 supports require() of an ESM module, so these resolve fine in
   * production; Jest's own module registry does not, so an untransformed one
   * fails its whole suite with "Cannot use import statement outside a module".
   *
   * sanitize-html 2.17.6 moved from htmlparser2 ^10 to ^12, which is ESM-only
   * (its exports map has a single `default` condition, so there is no CJS
   * build to map to) and brings five more ESM packages with it. pnpm installs
   * all six nested under sanitize-html, which exposed a second bug: the old
   * `node_modules/(?!(uuid)/)` anchored the name directly after the first
   * `node_modules/`, so it only ever matched a top-level entry and left every
   * nested copy ignored. The optional path group added below lets the name
   * sit at any depth.
   *
   * Guarded by src/common/utils/sanitization.util.spec.ts, which imports
   * sanitize-html and so cannot run at all if this list is wrong.
   */
  transformIgnorePatterns: [
    'node_modules/(?!(?:.*/)?(uuid|htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/**/*.module.ts', // NestJS modules are wiring-only, low test value
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
