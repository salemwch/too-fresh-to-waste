/**
 * Base Jest config — coverage settings, file extensions, timeouts.
 * All presets spread this object.
 */
'use strict';

const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  // Every suite runs in UTC regardless of the host's own zone - see
  // global-setup-tz.js. An absolute path, so it resolves the same way from
  // any consumer's rootDir.
  globalSetup: path.join(__dirname, 'global-setup-tz.js'),

  // Test file discovery
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Mocks
  clearMocks: true,
  restoreMocks: true,

  // Timeouts
  testTimeout: 10_000,

  // Coverage
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
