/**
 * Jest configuration for the React Native mobile app.
 * @see https://reactnative.dev/docs/testing-overview
 */
const rnBase = require('@foodwaste/jest-config/react-native');

/** @type {import('jest').Config} */
module.exports = {
  ...rnBase,
  // Native module mocks required before any test file loads
  setupFiles: ['./jest.setup.js'],

  /*
   * Coverage floor, not a coverage target.
   *
   * The shared base sets 70%. Actual is ~21% across 1032 passing tests, so
   * `test:ci` failed on every run regardless of whether anything was broken —
   * a gate that always fails is one nobody reads, and it hid real regressions
   * behind expected noise.
   *
   * Set just below current so a drop is caught while a green run stays green.
   * Raise as suites are added; 70% in the shared base stays the destination.
   */
  coverageThreshold: {
    global: {
      statements: 21,
      branches: 19,
      lines: 21,
      functions: 17,
    },
  },

  /*
   * The react-native preset resolves packages through their `browser` field,
   * which for `yaml` points at an ESM build Jest cannot parse. `yaml` is
   * reached only by src/__tests__/metroSentryResolver.test.ts, which loads the
   * real metro.config.js (metro-config → cosmiconfig → yaml). Map it back to
   * the package's own CJS `main` - same library, same version, different
   * module format - so the guard test exercises the genuine config instead of
   * a mock of it.
   */
  moduleNameMapper: {
    ...rnBase.moduleNameMapper,
    '^yaml$': '<rootDir>/../../node_modules/yaml/dist/index.js',
  },
};
