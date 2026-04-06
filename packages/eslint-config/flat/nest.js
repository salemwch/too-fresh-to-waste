/**
 * NestJS ESLint flat config (ESLint 9 format).
 * Returns an array of config objects to spread into eslint.config.js.
 *
 * Usage:
 *   const nestConfig = require('@foodwaste/eslint-config/flat/nest');
 *   module.exports = [...nestConfig, { // app-specific overrides }];
 *
 * App-specific rules (module boundaries) stay in the app's own config.
 */
'use strict';

const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ── TypeScript source files ────────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      import: importPlugin,
    },
    settings: {
      'import/resolver': { node: true },
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────────────────────────
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',

      // ── NestJS DI patterns ──────────────────────────────────────────────────
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/ban-types': 'off',
      'prefer-rest-params': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/parameter-properties': 'off',

      // ── Async ───────────────────────────────────────────────────────────────
      'require-await': 'error',
      'no-return-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // ── Security ────────────────────────────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      eqeqeq: ['error', 'always'],
      curly: 'error',

      // ── General ─────────────────────────────────────────────────────────────
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': process.env['NODE_ENV'] === 'production' ? 'error' : 'warn',
      'no-debugger': process.env['NODE_ENV'] === 'production' ? 'error' : 'warn',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
  // ── Test files ─────────────────────────────────────────────────────────────
  {
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
