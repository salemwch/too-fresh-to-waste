const nestBase = require('@foodwaste/jest-config/nestjs');

/** @type {import('jest').Config} */
module.exports = {
  ...nestBase,
  displayName: 'backend',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    ...nestBase.moduleNameMapper,
    // csv-writer has no types — shim provided by the backend
    'csv-writer': '<rootDir>/src/common/types/csv-writer.shim.ts',
  },
  setupFilesAfterEnv: [],
  testTimeout: 10_000,
};
