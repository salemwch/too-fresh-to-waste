/**
 * Base Jest config — coverage settings, file extensions, timeouts.
 * All presets spread this object.
 */
'use strict';

/** @type {import('jest').Config} */
module.exports = {
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
