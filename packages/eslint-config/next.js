/**
 * Next.js ESLint config — extends react, disables RN-specific rules.
 * Used by apps/web. Pair with eslint-config-next for full coverage.
 */
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@foodwaste/eslint-config/react'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    // Next.js App Router uses async server components — allow top-level async
    '@typescript-eslint/require-await': 'off',
    // Next.js pages / layouts use default exports
    'import/no-default-export': 'off',
  },
};
