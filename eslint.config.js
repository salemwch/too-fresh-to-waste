/**
 * Root monorepo ESLint config (flat, ESLint 9).
 *
 * Covers apps/mobile and packages/shared|ui. apps/food-waste-backend and
 * apps/web carry their own eslint.config.js - flat config does not cascade
 * from parent directories the way .eslintrc did, so each workspace that runs
 * its own lint needs its own entry point.
 *
 * The shared presets in packages/eslint-config are still authored in the
 * legacy format and are consumed here through FlatCompat rather than being
 * rewritten. That is deliberate: those files carry a lot of rule-by-rule
 * reasoning in comments, and a hand-port is exactly the kind of change that
 * silently drops a rule. FlatCompat is ESLint's own migration bridge and
 * preserves them verbatim.
 */
'use strict';

const path = require('node:path');
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  // `ignorePatterns` has no flat equivalent; a top-level `ignores` object is it.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/babel.config.js',
      '**/metro.config.js',
      '**/android/**',
      '**/ios/**',
      // has its own eslint.config.js
      'apps/food-waste-backend/**',
      // has its own eslint.config.js
      'apps/web/**',
      // has its own eslint.config.js
      'apps/mobile/**',
      // generated declaration files
      '**/*.d.ts',
      // compiled JS artifacts sitting in src (they belong in dist)
      'packages/shared/src/**/*.js',
    ],
  },

  ...compat.extends('@foodwaste/eslint-config/react-native'),

  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            path.join(__dirname, 'packages/shared/tsconfig.json'),
            path.join(__dirname, 'packages/ui/tsconfig.json'),
          ],
        },
      },
    },
  },

  // packages/shared - relax strict-boolean-expressions (cross-platform patterns)
  {
    files: ['packages/shared/**/*'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
    },
  },

  /*
   * Standalone Node scripts are not listed in any tsconfig (shared/ui both
   * include only src), so type-aware linting could not resolve them and failed
   * with "was not found by the project service".
   *
   * `allowDefaultProject` is the fix typescript-eslint provides for exactly
   * this - a handful of loose files that belong to no project. It hands them
   * TypeScript's default project, so every type-aware rule keeps running and a
   * real bug in this script is still reported. The alternative, switching
   * projectService off and disabling the dozen-odd rules that then error, would
   * have stopped the message rather than the problem.
   *
   * Console output is the point of a CLI script, so no-console is the one rule
   * genuinely turned off here.
   */
  {
    files: ['**/*.{mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['packages/*/scripts/*.mjs', 'packages/*/scripts/*.cjs'],
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
