/**
 * React Native ESLint config — extends react with RN-specific rules.
 * Used by apps/mobile.
 */
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@foodwaste/eslint-config/react'],
  plugins: ['react-native'],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  rules: {
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off',
    'react-native/sort-styles': 'off',
  },
};
