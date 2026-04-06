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
};
