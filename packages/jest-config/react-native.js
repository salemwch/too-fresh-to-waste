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
  // Ships ESM (`export { default as Bar } from './Bar'`). Reached through
  // design-system molecules -> PasswordStrengthIndicator, so any suite that
  // renders LoginScreen or RegisterScreen hits it.
  'react-native-progress',
  // Ships ESM (`export { Toast as default }`). Reached indirectly by anything
  // importing utils/errorHandler → utils/toast, so any screen test hits it.
  'react-native-toast-message',
  'react-native-gesture-handler',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-fast-image',
  'react-native-vector-icons',
  'react-native-mmkv',
  'react-native-config',
  // Not an RN package, but the RN preset resolves Redux Toolkit's dependency
  // on immer to its `legacy-esm` build, which Jest cannot parse untransformed.
  // Any test that imports a slice hits this.
  'immer',
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
    // Bare package imports only ('@react-native-vector-icons/ionicons') — the
    // icon COMPONENTS need stubbing because they touch native font loading.
    // Deep imports ('.../ionicons/glyphmaps/Ionicons.json') are plain data and
    // must resolve for real: the icon-font subset guard reads the glyphmap to
    // verify every referenced icon exists in the shipped font, and the old
    // catch-all pattern handed it the stub's source text instead of JSON.
    '^@react-native-vector-icons/([^/]+)$': '<rootDir>/jest.vectorIconsStub.js',
    // Binary assets stub — prevents transform errors for images/fonts
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/jest.assetStub.js',
  },
  // The optional path group lets a package match at any depth: pnpm nests
  // transitive copies under their parent, and anchoring the name directly
  // after the first node_modules segment would leave every nested copy
  // untransformed.
  transformIgnorePatterns: [`node_modules/(?!(?:.*/)?(${RN_ESM_PACKAGES})/)`],
};
