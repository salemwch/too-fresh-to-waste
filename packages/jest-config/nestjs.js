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
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
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
