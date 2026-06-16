/**
 * React Native Jest config — react-native preset, ESM transform allowlist.
 *
 * Usage in apps/mobile/jest.config.js:
 *   const base = require('@foodwaste/jest-config/react-native');
 *   module.exports = { ...base, setupFiles: ['./jest.setup.js'] };
 */
'use strict';

const base = require('./base');

// RN packages that ship as ESM/Flow/TS and must be transformed by Babel
const RN_ESM_PACKAGES = [
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-navigation',
  '@sentry',
  '@testing-library/react-native',
  'react-native-haptic-feedback',
  'react-native-linear-gradient',
  'react-native-reanimated',
  'react-native-gesture-handler',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-fast-image',
  'react-native-vector-icons',
  'react-native-mmkv',
  'react-native-config',
].join('|');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  preset: 'react-native',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/store/rehydrationOrchestrator.ts', // known pre-existing TS errors
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@foodwaste/shared$': '<rootDir>/../../packages/shared/src',
    '^@react-native-vector-icons/(.*)$': '<rootDir>/jest.vectorIconsStub.js',
    // Binary assets stub — prevents transform errors for images/fonts
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/jest.assetStub.js',
  },
  transformIgnorePatterns: [`node_modules/(?!(${RN_ESM_PACKAGES})/)`],
};
