/**
 * Jest Configuration for React Native Mobile App
 *
 * Uses @react-native/jest-preset which provides:
 * - Correct transformIgnorePatterns for RN packages
 * - react-native mock setup
 * - Platform-specific module resolution
 *
 * @see https://reactnative.dev/docs/testing-overview
 */

module.exports = {
  preset: 'react-native',

  // Module path aliases — must mirror babel.config.js and tsconfig.json
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@foodwaste/shared$': '<rootDir>/../../packages/shared/src',
  },

  // Setup files — native module mocks required before any test file loads
  setupFiles: ['./jest.setup.js'],

  // Test file discovery
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],

  // Transform RN + community packages that ship ESM/Flow/TS
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native' +
      '|@react-native' +
      '|@react-native-community' +
      '|@react-native-vector-icons' +
      '|react-native-haptic-feedback' +
      '|react-native-linear-gradient' +
      '|react-native-reanimated' +
      '|react-native-gesture-handler' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|react-native-fast-image' +
      '|react-native-vector-icons' +
      '|react-native-mmkv' +
      '|@react-navigation' +
      '|@testing-library/react-native' +
      ')/)',
  ],

  // Map binary assets (fonts, images) to a stub so they don't crash transforms
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@foodwaste/shared$': '<rootDir>/../../packages/shared/src',
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/jest.assetStub.js',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
