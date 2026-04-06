/**
 * NestJS ESLint config (legacy format) — extends base with Node/async rules.
 * Used by apps/food-waste-backend if it opts into legacy format.
 * App-specific rules (module boundaries, import/no-restricted-paths) stay
 * in the app's own eslint config, NOT here.
 */
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@foodwaste/eslint-config/base'],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  rules: {
    // ── Async / promises ─────────────────────────────────────────────────────
    'require-await': 'error',
    'no-return-await': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/promise-function-async': 'error',

    // ── NestJS DI / decorator patterns ────────────────────────────────────────
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/ban-types': 'off',
    'prefer-rest-params': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/parameter-properties': 'off',

    // ── Security ──────────────────────────────────────────────────────────────
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    eqeqeq: ['error', 'always'],
    curly: 'error',

    // ── Production stricter console ───────────────────────────────────────────
    'no-console': process.env['NODE_ENV'] === 'production' ? 'error' : 'warn',
    'no-debugger': process.env['NODE_ENV'] === 'production' ? 'error' : 'warn',

    // ── Code style ────────────────────────────────────────────────────────────
    '@typescript-eslint/prefer-readonly': 'warn',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
  },
};
