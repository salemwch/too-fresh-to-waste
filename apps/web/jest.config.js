/**
 * Jest configuration for the Next.js web app.
 * next/jest handles SWC transpilation, CSS/image mocking, and module aliases.
 */
const nextJest = require('next/jest');
const nextBase = require('@foodwaste/jest-config/next');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  ...nextBase,
  displayName: 'web',
};

module.exports = createJestConfig(customConfig);
